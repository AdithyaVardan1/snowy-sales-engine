#!/usr/bin/env python3
"""
instagrapi_bridge.py — Instagram sidecar for Sales Engine
Called by Node.js via child_process.spawn.

stdin:  JSON with one of:
  { action: "login",         username, password }
  { action: "check_session", session_json }
  { action: "get_followers", session_json, user_id, amount? }
  { action: "send_dm",       session_json, user_id, text }
  { action: "get_user_info", session_json }

stdout: JSON { success, ...fields, error? }
"""

import sys
import json
from instagrapi import Client
from instagrapi.exceptions import (
    LoginRequired,
    ChallengeRequired,
    TwoFactorRequired,
    PleaseWaitFewMinutes,
    ClientError,
)


def build_client_from_session(session_json: str) -> Client:
    """Restore a client from a saved session JSON string."""
    cl = Client()
    settings = json.loads(session_json)
    cl.set_settings(settings)
    # Re-login using session ID to refresh headers
    cl.login_by_sessionid(cl.sessionid)
    return cl


def handle_login(payload: dict) -> dict:
    username = payload.get("username", "")
    password = payload.get("password", "")
    verification_code = payload.get("verification_code", "")
    challenge_context = payload.get("challenge_context", "")
    if not username or not password:
        return {"success": False, "error": "username and password required"}

    cl = Client()

    # If we have a saved challenge context, restore client state and resolve the challenge
    if challenge_context:
        try:
            ctx = json.loads(challenge_context)
            cl.set_settings(ctx["settings"])
            cl.last_json = ctx.get("last_json", {})

            challenge_url = ctx.get("challenge_url", "")
            step_name = ctx.get("step_name", "")

            if step_name == "delta_login_review":
                # "It Was Me" — user approved in app, we just confirm
                cl._send_private_request(challenge_url, {"choice": "0"})
                cl.authorization_data = cl.parse_authorization(
                    cl.last_response.headers.get("ig-set-authorization")
                )
                cl.login_flow()
                session_json = json.dumps(cl.get_settings())
                return {
                    "success": True,
                    "session_json": session_json,
                    "username": username,
                    "user_id": str(cl.user_id),
                }
            else:
                # Unknown step, fall through to normal login
                pass
        except Exception as e:
            # Challenge resolve failed, fall through to fresh login
            sys.stderr.write(f"Challenge resolve failed: {e}\n")
            cl = Client()

    try:
        cl.login(username, password, verification_code=verification_code if verification_code else "")
    except TwoFactorRequired:
        # 2FA code flow — instagrapi handles this natively on next call with code
        # No special state needed: cl.login() re-does accounts/login/ and catches
        # TwoFactorRequired internally when verification_code is provided
        return {"success": False, "error": "two_factor_required", "code": "2FA"}
    except ChallengeRequired:
        # Challenge flow — save client state + challenge URL for retry
        try:
            last_json = cl.last_json or {}
            challenge_info = last_json.get("challenge", {})
            challenge_url = challenge_info.get("api_path", "")

            # Do the initial GET to the challenge URL to get step info
            if challenge_url:
                try:
                    cl._send_private_request(challenge_url[1:], params={
                        "guid": cl.uuid,
                        "device_id": cl.android_device_id,
                    })
                except ChallengeRequired:
                    pass  # Expected, continue

                step_name = cl.last_json.get("step_name", "")
                ctx = {
                    "settings": cl.get_settings(),
                    "last_json": cl.last_json,
                    "challenge_url": challenge_url,
                    "step_name": step_name,
                }
                return {
                    "success": False,
                    "error": "challenge_required",
                    "code": "CHALLENGE",
                    "challenge_context": json.dumps(ctx),
                    "step_name": step_name,
                }
        except Exception as e:
            sys.stderr.write(f"Challenge context save failed: {e}\n")
        return {"success": False, "error": "challenge_required", "code": "CHALLENGE"}
    except PleaseWaitFewMinutes:
        return {"success": False, "error": "Rate limited — please wait a few minutes and try again"}
    except Exception as e:
        return {"success": False, "error": str(e)}

    # Serialize session for storage
    session_json = json.dumps(cl.get_settings())
    user_id = str(cl.user_id)

    return {
        "success": True,
        "session_json": session_json,
        "username": username,
        "user_id": user_id,
    }


def handle_check_session(payload: dict) -> dict:
    session_str = payload.get("session_json", "")
    if not session_str:
        return {"success": False, "error": "session_json required"}

    try:
        cl = build_client_from_session(session_str)
        info = cl.account_info()
        return {
            "success": True,
            "valid": True,
            "username": info.username,
            "user_id": str(info.pk),
        }
    except (LoginRequired, ClientError):
        return {"success": True, "valid": False, "error": "Session expired"}
    except Exception as e:
        return {"success": False, "valid": False, "error": str(e)}


def handle_get_followers(payload: dict) -> dict:
    session_str = payload.get("session_json", "")
    user_id = payload.get("user_id", "")
    amount = payload.get("amount", 200)

    if not session_str or not user_id:
        return {"success": False, "error": "session_json and user_id required"}

    try:
        cl = build_client_from_session(session_str)
        followers = cl.user_followers(int(user_id), amount=int(amount))

        follower_list = []
        for uid, user in followers.items():
            follower_list.append({
                "user_id": str(uid),
                "username": user.username,
                "full_name": user.full_name or "",
                "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else "",
                "is_private": user.is_private,
            })

        return {"success": True, "followers": follower_list}
    except LoginRequired:
        return {"success": False, "error": "Session expired — please re-login"}
    except PleaseWaitFewMinutes:
        return {"success": False, "error": "Rate limited — please wait a few minutes"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def handle_send_dm(payload: dict) -> dict:
    session_str = payload.get("session_json", "")
    user_id = payload.get("user_id", "")
    text = payload.get("text", "")

    if not session_str or not user_id or not text:
        return {"success": False, "error": "session_json, user_id, and text required"}

    try:
        cl = build_client_from_session(session_str)
        result = cl.direct_send(text, [int(user_id)])
        thread_id = str(result.thread_id) if hasattr(result, "thread_id") and result.thread_id else ""
        message_id = str(result.id) if hasattr(result, "id") and result.id else ""

        return {
            "success": True,
            "thread_id": thread_id,
            "message_id": message_id,
        }
    except LoginRequired:
        return {"success": False, "error": "Session expired — please re-login"}
    except PleaseWaitFewMinutes:
        return {"success": False, "error": "Rate limited — please wait a few minutes"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def handle_get_user_info(payload: dict) -> dict:
    session_str = payload.get("session_json", "")
    if not session_str:
        return {"success": False, "error": "session_json required"}

    try:
        cl = build_client_from_session(session_str)
        info = cl.account_info()
        return {
            "success": True,
            "user_id": str(info.pk),
            "username": info.username,
            "full_name": info.full_name or "",
            "follower_count": info.follower_count,
            "following_count": info.following_count,
            "profile_pic_url": str(info.profile_pic_url) if info.profile_pic_url else "",
        }
    except LoginRequired:
        return {"success": False, "error": "Session expired — please re-login"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def handle_get_user_by_username(payload: dict) -> dict:
    """Get public info for any user by their username."""
    session_str = payload.get("session_json", "")
    username = payload.get("username", "")
    if not session_str or not username:
        return {"success": False, "error": "session_json and username required"}

    try:
        cl = build_client_from_session(session_str)
        info = cl.user_info_by_username(username)
        return {
            "success": True,
            "user_id": str(info.pk),
            "username": info.username,
            "full_name": info.full_name or "",
            "biography": info.biography or "",
            "follower_count": info.follower_count,
            "following_count": info.following_count,
            "media_count": info.media_count,
            "is_private": info.is_private,
            "is_business": info.is_business_account if hasattr(info, "is_business_account") else False,
            "profile_pic_url": str(info.profile_pic_url) if info.profile_pic_url else "",
        }
    except LoginRequired:
        return {"success": False, "error": "Session expired — please re-login"}
    except PleaseWaitFewMinutes:
        return {"success": False, "error": "Rate limited — please wait a few minutes"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def handle_get_dm_inbox(payload: dict) -> dict:
    """Fetch recent DM threads from the inbox."""
    session_str = payload.get("session_json", "")
    amount = payload.get("amount", 20)
    if not session_str:
        return {"success": False, "error": "session_json required"}

    try:
        cl = build_client_from_session(session_str)
        threads = cl.direct_threads(amount=int(amount))

        conversations = []
        for thread in threads:
            participants = []
            for user in thread.users:
                participants.append({
                    "user_id": str(user.pk),
                    "username": user.username,
                    "full_name": user.full_name or "",
                })

            messages = []
            for msg in (thread.messages or []):
                messages.append({
                    "id": str(msg.id) if msg.id else "",
                    "sender_id": str(msg.user_id) if msg.user_id else "",
                    "text": msg.text or "",
                    "timestamp": msg.timestamp.isoformat() if hasattr(msg, "timestamp") and msg.timestamp else "",
                })

            conversations.append({
                "thread_id": str(thread.id) if thread.id else "",
                "participants": participants,
                "messages": messages,
            })

        return {"success": True, "conversations": conversations}
    except LoginRequired:
        return {"success": False, "error": "Session expired — please re-login"}
    except PleaseWaitFewMinutes:
        return {"success": False, "error": "Rate limited — please wait a few minutes"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def handle_search_users(payload: dict) -> dict:
    """Search Instagram users by query string."""
    session_str = payload.get("session_json", "")
    query = payload.get("query", "")
    amount = payload.get("amount", 10)
    if not session_str or not query:
        return {"success": False, "error": "session_json and query required"}

    try:
        cl = build_client_from_session(session_str)
        users = cl.search_users(query, int(amount))

        results = []
        for user in users:
            results.append({
                "user_id": str(user.pk),
                "username": user.username,
                "full_name": user.full_name or "",
                "biography": user.biography if hasattr(user, "biography") else "",
                "follower_count": user.follower_count if hasattr(user, "follower_count") else 0,
                "is_private": user.is_private if hasattr(user, "is_private") else False,
                "profile_pic_url": str(user.profile_pic_url) if user.profile_pic_url else "",
            })

        return {"success": True, "users": results}
    except LoginRequired:
        return {"success": False, "error": "Session expired — please re-login"}
    except PleaseWaitFewMinutes:
        return {"success": False, "error": "Rate limited — please wait a few minutes"}
    except Exception as e:
        return {"success": False, "error": str(e)}


HANDLERS = {
    "login": handle_login,
    "check_session": handle_check_session,
    "get_followers": handle_get_followers,
    "send_dm": handle_send_dm,
    "get_user_info": handle_get_user_info,
    "get_user_by_username": handle_get_user_by_username,
    "get_dm_inbox": handle_get_dm_inbox,
    "search_users": handle_search_users,
}


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print(json.dumps({"success": False, "error": "No input received on stdin"}))
        sys.exit(1)

    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        print(json.dumps({"success": False, "error": f"Invalid JSON: {e}"}))
        sys.exit(1)

    action = payload.get("action", "")
    handler = HANDLERS.get(action)
    if not handler:
        result = {"success": False, "error": f"Unknown action: {action}"}
    else:
        result = handler(payload)

    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()

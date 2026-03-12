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
    if not username or not password:
        return {"success": False, "error": "username and password required"}

    cl = Client()
    try:
        cl.login(username, password)
    except TwoFactorRequired:
        return {"success": False, "error": "two_factor_required", "code": "2FA"}
    except ChallengeRequired:
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


HANDLERS = {
    "login": handle_login,
    "check_session": handle_check_session,
    "get_followers": handle_get_followers,
    "send_dm": handle_send_dm,
    "get_user_info": handle_get_user_info,
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

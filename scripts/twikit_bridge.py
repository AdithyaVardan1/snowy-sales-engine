#!/usr/bin/env python3
"""
twikit_bridge.py — Twikit posting sidecar for Sales Engine
Called by Node.js via child_process.spawn.

stdin:  JSON with one of:
  { action: "tweet",  text, cookies }
  { action: "reply",  text, reply_to, cookies }
  { action: "thread", tweets: [...], cookies }
  { action: "search", query, count, cookies }
  { action: "dm",  text, target_username, cookies }

stdout: JSON { success, tweet_id?, tweet_ids?, count?, tweets?, error? }
"""

import sys
import json
import asyncio
from twikit import Client


def build_client(cookies_data):
    """Create and configure a Twikit client from cookies data."""
    client = Client("en-US")

    if isinstance(cookies_data, list):
        # Browser-export array format: [{name, value}, ...]
        cookie_dict = {
            c["name"]: c["value"]
            for c in cookies_data
            if "name" in c and "value" in c
        }
    elif isinstance(cookies_data, dict):
        cookie_dict = cookies_data
    else:
        return None, "Unknown cookies format"

    client.set_cookies(cookie_dict)
    return client, None


async def run(payload: dict) -> dict:
    action      = payload.get("action")       # "tweet" | "reply" | "thread" | "search"
    text        = payload.get("text", "")
    reply_to    = payload.get("reply_to")     # tweet ID to reply to
    tweets      = payload.get("tweets", [])   # array of strings for thread
    query       = payload.get("query", "")    # search query
    count       = payload.get("count", 20)    # search limit
    target_username = payload.get("target_username")  # for DMs
    cookies_data = payload.get("cookies")

    if not cookies_data:
        return {"success": False, "error": "No cookies provided"}

    client, err = build_client(cookies_data)
    if err:
        return {"success": False, "error": err}

    try:
        # ── Single tweet ────────────────────────────────────────────────────
        if action == "tweet":
            if not text:
                return {"success": False, "error": "No text provided"}
            result = await client.create_tweet(text=text)
            if not result:
                return {"success": False, "error": "Empty response from Twikit"}
            tweet_id = str(result.id) if hasattr(result, "id") else str(result)
            return {"success": True, "tweet_id": tweet_id, "text": text}

        # ── Reply ────────────────────────────────────────────────────────────
        elif action == "reply":
            if not text:
                return {"success": False, "error": "No text provided"}
            if not reply_to:
                return {"success": False, "error": "reply_to is required for reply action"}
            result = await client.create_tweet(text=text, reply_to=reply_to)
            if not result:
                return {"success": False, "error": "Empty response from Twikit"}
            tweet_id = str(result.id) if hasattr(result, "id") else str(result)
            return {"success": True, "tweet_id": tweet_id, "text": text}

        # ── Thread ───────────────────────────────────────────────────────────
        elif action == "thread":
            if not tweets:
                return {"success": False, "error": "tweets array is empty"}

            ids = []
            last_id = None

            for i, tweet_text in enumerate(tweets):
                # Human-ish delay between tweets (skip before first)
                if i > 0:
                    await asyncio.sleep(4)

                if last_id:
                    result = await client.create_tweet(text=tweet_text, reply_to=last_id)
                else:
                    result = await client.create_tweet(text=tweet_text)

                if not result:
                    return {
                        "success": False,
                        "error": f"Empty response on tweet {i + 1}/{len(tweets)}",
                        "ids_so_far": ids,
                    }

                tweet_id = str(result.id) if hasattr(result, "id") else str(result)
                ids.append(tweet_id)
                last_id = tweet_id

            return {"success": True, "tweet_ids": ids, "count": len(ids)}

        # ── Search ───────────────────────────────────────────────────────────
        elif action == "search":
            if not query:
                return {"success": False, "error": "query is required for search action"}
            
            # Use 'Latest' as the product to get recent tweets, equivalent to what graphql SEARCH_TIMELINE used
            search_results = await client.search_tweet(query, "Latest", count=count)
            loaded_tweets = []
            
            for t in search_results:
                loaded_tweets.append({
                    "id": str(t.id),
                    "text": t.text,
                    "author": t.user.name if hasattr(t, "user") and t.user else "",
                    "authorHandle": t.user.screen_name if hasattr(t, "user") and t.user else "",
                    "createdAt": str(t.created_at),
                    "replyCount": t.reply_count,
                    "retweetCount": t.retweet_count,
                    "likeCount": getattr(t, 'favorite_count', getattr(t, 'like_count', 0)),
                    "url": f"https://x.com/{t.user.screen_name}/status/{t.id}" if hasattr(t, "user") and t.user else "",
                })
            return {"success": True, "tweets": loaded_tweets, "count": len(loaded_tweets)}

        # ── Send Direct Message ──────────────────────────────────────────────
        elif action == "dm":
            if not text:
                return {"success": False, "error": "No text provided for DM"}
            if not target_username:
                return {"success": False, "error": "target_username is required for dm action"}
            
            # Need to get user ID by their handle first
            user = await client.get_user_by_screen_name(target_username)
            if not user:
                return {"success": False, "error": f"Failed to find user @{target_username}"}
            
            result = await client.send_dm(user.id, text)
            if not result:
                return {"success": False, "error": "Empty response from send_dm"}
            
            dm_id = str(result.id) if hasattr(result, "id") else str(result)
            return {"success": True, "dm_id": dm_id, "text": text}

        else:
            return {"success": False, "error": f"Unknown action: {action}"}

    except Exception as e:
        return {"success": False, "error": str(e)}


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

    result = asyncio.run(run(payload))
    print(json.dumps(result))
    sys.exit(0 if result.get("success") else 1)


if __name__ == "__main__":
    main()

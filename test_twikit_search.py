import asyncio
from twikit import Client
import json

async def main():
    try:
        with open("cookies_poster.json", "r") as f:
            cookie_dict = json.load(f)
        client = Client("en-US")
        client.set_cookies(cookie_dict)
        tweets = await client.search_tweet("openclaw help", "Latest", count=5)
        for t in tweets:
            print(f"tweet: {t.id} ||| {t.user.name} ||| {t.text}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(main())

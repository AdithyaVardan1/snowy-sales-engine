import asyncio
import json
import sys

# Test payload for DM
payload = {
    "action": "dm",
    "target_username": "x",  # Just testing it can hit the endpoint. Wait, don't send a real DM unless needed. Or just send to an owned account?
    # actually, I can just provide a username that might fail, but let's see. Or I'll just check if the payload works.
}

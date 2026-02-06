import time

# Simple in-memory storage (Resets on server restart/cold start)
# key: ip, value: last_post_timestamp
last_posts = {}

def can_post(ip, cooldown_seconds=60):
    """Checks if an IP is allowed to post based on a cooldown."""
    current_time = time.time()
    if ip in last_posts:
        elapsed = current_time - last_posts[ip]
        if elapsed < cooldown_seconds:
            return False, int(cooldown_seconds - elapsed)
    
    # Update last post time
    last_posts[ip] = current_time
    return True, 0

"""
Run independent database reads concurrently.

Every MongoDB round trip to Atlas costs a few hundred milliseconds, so an endpoint that needs several
independent counts should pay for the slowest one instead of their sum. pymongo is thread-safe and
pools its connections, so the reads simply run on worker threads.
"""

import threading
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict

# A gather() nested inside another one uses its own pool, so outer workers never wait for a slot that
# only they could free. Deeper nesting runs inline.
_OUTER_PREFIX = "wa-db-outer"
_NESTED_PREFIX = "wa-db-nested"
_outer_pool = ThreadPoolExecutor(max_workers=32, thread_name_prefix=_OUTER_PREFIX)
_nested_pool = ThreadPoolExecutor(max_workers=64, thread_name_prefix=_NESTED_PREFIX)


def gather(**calls: Callable[[], Any]) -> Dict[str, Any]:
    """Run each zero-argument callable concurrently and return their results under the same names."""
    thread = threading.current_thread().name
    if thread.startswith(_NESTED_PREFIX):
        return {name: fn() for name, fn in calls.items()}
    pool = _nested_pool if thread.startswith(_OUTER_PREFIX) else _outer_pool
    futures = {name: pool.submit(fn) for name, fn in calls.items()}
    return {name: future.result() for name, future in futures.items()}

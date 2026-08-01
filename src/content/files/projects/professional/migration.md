# migration

Thirty years of data and business logic, moving off a legacy PICK multivalue
database onto MongoDB.

Power doesn't stop. There's no maintenance window, no scheduled outage, no
quiet Sunday to cut over. The grid runs 24/7 and so does everything behind
it. So the new system gets built in parallel with the old one, both live,
until the day the old one isn't.

Data is the smaller half. Thirty years of business logic lives in that
database too, and every rule has to be found, understood, and rebuilt before
anything can be retired. It is documented, in its own way: comments in the
code, three decades of them, across a system too large to hold in your head.

The turning point was a documentation sweep with AI. Decades of accumulated
business rules, finally navigable. It's the most valuable thing AI has done
for us, and the migration would be far harder without it.

Still in progress. The finish line is in sight.

**stack**: MongoDB, FastAPI, Python

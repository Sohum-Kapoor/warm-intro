window.SAMPLE_RUN = {
  "synthetic": true,
  "run_id": "sample-0001",
  "mode": "proactive",
  "request": null,
  "stats": {"pairs_scored": 15, "passed_filter": 3, "meetings": 2, "introductions": 2},
  "members": [
    {"id": "m001", "type": "small_business", "name": "Kestrel Stamping", "hub": "grand_rapids", "sector": "metal stamping"},
    {"id": "m002", "type": "startup", "name": "Lumen Sight", "hub": "detroit", "sector": "machine vision"},
    {"id": "m003", "type": "individual", "name": "Priya N.", "hub": "ann_arbor", "sector": "computer science student"},
    {"id": "m004", "type": "startup", "name": "Tern Aerial", "hub": "detroit", "sector": "drones"},
    {"id": "m005", "type": "corporation", "name": "Great Lakes Mobility Group", "hub": "detroit", "sector": "automotive"},
    {"id": "m006", "type": "individual", "name": "Marcus D.", "hub": "grand_rapids", "sector": "brand marketing"}
  ],
  "candidates": [
    {
      "a": "m001", "b": "m002", "fit": 0.84, "novelty": 0.58, "weight": 1.1, "cross_hub": true,
      "score": 1.07, "label": "unexpected",
      "evidence": [{"need_of": "m001", "need": "catch surface defects on stamped parts without adding inspectors", "offer_of": "m002", "offer": "camera-based defect detection that installs on an existing line", "similarity": 0.84}]
    },
    {
      "a": "m004", "b": "m003", "fit": 0.71, "novelty": 0.33, "weight": 1.0, "cross_hub": true,
      "score": 0.80, "label": "complementary",
      "evidence": [{"need_of": "m004", "need": "a part-time engineer for flight-path software", "offer_of": "m003", "offer": "robotics and path-planning coursework, available 15 hours a week", "similarity": 0.71}]
    }
  ],
  "meetings": [
    {
      "id": "mt001", "a": "m001", "b": "m002",
      "transcript": [
        {"speaker": "m001", "turn": 1, "text": "Kestrel runs three stamping lines and loses time to surface defects found late. We need detection on the line, and we can't stop production for a long install."},
        {"speaker": "m002", "turn": 1, "text": "Lumen Sight's cameras mount on an existing line in a day. We need a first manufacturing pilot in Michigan and would price it accordingly."},
        {"speaker": "m001", "turn": 2, "text": "A paid pilot on one line is possible. An unpaid trial is not something we do. Who owns the defect images?"},
        {"speaker": "m002", "turn": 2, "text": "You keep the images. A paid one-line pilot for eight weeks works for us."}
      ],
      "votes": {
        "m001": {"vote": "yes", "reason": "It addresses our stated defect problem, and a paid one-line pilot respects our limits."},
        "m002": {"vote": "yes", "reason": "A paying first manufacturing pilot in Michigan is exactly what we need."}
      },
      "result": "introduced"
    },
    {
      "id": "mt002", "a": "m004", "b": "m003",
      "transcript": [
        {"speaker": "m004", "turn": 1, "text": "Tern Aerial needs help on flight-path software. We can offer equity but no salary until our next round."},
        {"speaker": "m003", "turn": 1, "text": "Priya is interested in the work. She needs paid work this term and can't take an unpaid role."},
        {"speaker": "m004", "turn": 2, "text": "Understood. We can't pay before the spring."}
      ],
      "votes": {
        "m004": {"vote": "yes", "reason": "The skills match our need closely."},
        "m003": {"vote": "no", "reason": "The role is unpaid, which is one of my member's deal-breakers."}
      },
      "result": "declined"
    }
  ],
  "introductions": [
    {"meeting_id": "mt001", "to": "m001", "from_agent": "agent:m001", "message": "I met with the agent for Lumen Sight, a Detroit machine-vision startup. They can install defect detection on one of your lines in a day and agreed to a paid eight-week pilot where you keep the images. Suggested next step: a 30-minute call next week."},
    {"meeting_id": "mt001", "to": "m002", "from_agent": "agent:m002", "message": "I met with the agent for Kestrel Stamping in Grand Rapids. They have a late-detected surface defect problem and are open to a paid one-line pilot for eight weeks. Suggested next step: a 30-minute call next week."}
  ],
  "weights_before": {"small_business-startup|unexpected": 1.1, "individual-startup|complementary": 1.0},
  "weights_after": {"small_business-startup|unexpected": 1.1, "individual-startup|complementary": 0.97}
}
;

window.DEMO_RUN = {
  "synthetic": true,
  "run_id": "2026-11-13T13-05-02",
  "mode": "proactive",
  "request": null,
  "status": "complete",
  "stats": {
    "pairs_scored": 28,
    "passed_filter": 5,
    "meetings": 5,
    "introductions": 8
  },
  "members": [
    {
      "id": "m001",
      "type": "small_business",
      "name": "Kestrel Stamping",
      "hub": "grand_rapids",
      "sector": "metal stamping",
      "demo": true
    },
    {
      "id": "m002",
      "type": "startup",
      "name": "Lumen Sight",
      "hub": "detroit",
      "sector": "machine vision",
      "demo": true
    },
    {
      "id": "m003",
      "type": "individual",
      "name": "Priya N.",
      "hub": "ann_arbor",
      "sector": "computer science student",
      "demo": true
    },
    {
      "id": "m004",
      "type": "startup",
      "name": "Tern Aerial",
      "hub": "detroit",
      "sector": "drones",
      "demo": true
    },
    {
      "id": "m005",
      "type": "corporation",
      "name": "Great Lakes Mobility Group",
      "hub": "detroit",
      "sector": "automotive",
      "demo": true
    },
    {
      "id": "m006",
      "type": "individual",
      "name": "Marcus D.",
      "hub": "grand_rapids",
      "sector": "brand marketing",
      "demo": true
    },
    {
      "id": "m007",
      "type": "startup",
      "name": "Oatwhistle Foods",
      "hub": "ann_arbor",
      "sector": "food technology",
      "demo": true
    },
    {
      "id": "m008",
      "type": "startup",
      "name": "Brindle Route",
      "hub": "grand_rapids",
      "sector": "supply chain software",
      "demo": true
    }
  ],
  "candidates": [
    {
      "a": "m003",
      "b": "m004",
      "fit": 1.09,
      "novelty": 0.38,
      "weight": 1.32,
      "cross_hub": true,
      "score": 1.59,
      "label": "complementary",
      "evidence": [
        {
          "need_of": "m003",
          "need": "a hands-on flight software role on a small drone team",
          "offer_of": "m004",
          "offer": "hands-on flight software roles on a small drone team",
          "similarity": 0.991
        },
        {
          "need_of": "m004",
          "need": "a student engineer for flight path planning software",
          "offer_of": "m003",
          "offer": "robotics student who can engineer flight path planning software 15 hours a week",
          "similarity": 0.864
        }
      ]
    },
    {
      "a": "m007",
      "b": "m006",
      "fit": 1.043,
      "novelty": 0.356,
      "weight": 1.32,
      "cross_hub": true,
      "score": 1.52,
      "label": "complementary",
      "evidence": [
        {
          "need_of": "m007",
          "need": "brand launch strategy and packaging story for a new food product",
          "offer_of": "m006",
          "offer": "brand launch strategy and packaging story for food and beverage products",
          "similarity": 0.948
        },
        {
          "need_of": "m006",
          "need": "an early food or beverage brand to build from the start",
          "offer_of": "m007",
          "offer": "a new food brand with a product ready to launch and room for a first marketing hire",
          "similarity": 0.797
        }
      ]
    },
    {
      "a": "m002",
      "b": "m001",
      "fit": 1.003,
      "novelty": 0.415,
      "weight": 1.24,
      "cross_hub": true,
      "score": 1.386,
      "label": "unexpected",
      "evidence": [
        {
          "need_of": "m002",
          "need": "a stamping plant for a paid pilot of camera inspection on a production line",
          "offer_of": "m001",
          "offer": "a stamping production line for pilots of camera inspection hardware",
          "similarity": 0.911
        },
        {
          "need_of": "m001",
          "need": "surface defect inspection for stamped parts",
          "offer_of": "m002",
          "offer": "camera surface defect inspection for stamped parts that mounts on a running line",
          "similarity": 0.84
        }
      ]
    },
    {
      "a": "m005",
      "b": "m008",
      "fit": 1.056,
      "novelty": 0.322,
      "weight": 1.0,
      "cross_hub": true,
      "score": 1.16,
      "label": "complementary",
      "evidence": [
        {
          "need_of": "m005",
          "need": "live shipment tracking for inbound parts across several plants",
          "offer_of": "m008",
          "offer": "live shipment tracking for inbound parts across several plants, tied to dispatch records",
          "similarity": 0.96
        },
        {
          "need_of": "m008",
          "need": "a large manufacturer to pilot live shipment tracking across several plants",
          "offer_of": "m005",
          "offer": "a multi-plant manufacturer pilot site with real inbound shipments",
          "similarity": 0.809
        }
      ]
    },
    {
      "a": "m002",
      "b": "m005",
      "fit": 0.699,
      "novelty": 0.381,
      "weight": 1.0,
      "cross_hub": false,
      "score": 0.756,
      "label": "unexpected",
      "evidence": [
        {
          "need_of": "m002",
          "need": "a stamping plant for a paid pilot of camera inspection on a production line",
          "offer_of": "m005",
          "offer": "a multi-plant manufacturer pilot site with real inbound shipments",
          "similarity": 0.699
        }
      ]
    }
  ],
  "meetings": [
    {
      "id": "mt001",
      "a": "m003",
      "b": "m004",
      "candidate": {
        "a": "m003",
        "b": "m004",
        "fit": 1.09,
        "novelty": 0.38,
        "weight": 1.32,
        "cross_hub": true,
        "score": 1.59,
        "label": "complementary",
        "evidence": [
          {
            "need_of": "m003",
            "need": "a hands-on flight software role on a small drone team",
            "offer_of": "m004",
            "offer": "hands-on flight software roles on a small drone team",
            "similarity": 0.991
          },
          {
            "need_of": "m004",
            "need": "a student engineer for flight path planning software",
            "offer_of": "m003",
            "offer": "robotics student who can engineer flight path planning software 15 hours a week",
            "similarity": 0.864
          }
        ]
      },
      "transcript": [
        {
          "speaker": "m003",
          "turn": 1,
          "text": "I represent Priya N., a master's student in computer science focusing on robotics and path planning. She is seeking a hands-on flight software role on a small drone team, offering her expertise in engineering flight path planning software for 15 hours a week, along with her coursework and simulation code."
        },
        {
          "speaker": "m004",
          "turn": 1,
          "text": "We at Tern Aerial are building inspection drones for bridges and wind turbines. We need a student engineer for flight path planning software and a bridge owner to host inspection flights. We offer hands-on flight software roles on a small drone team, with equity in the company, though the first roles would be unpaid until our spring funding round closes."
        },
        {
          "speaker": "m003",
          "turn": 2,
          "text": "Priya is looking for paid engineering experience that fits around her classes. Since the offered roles at Tern Aerial are unpaid, she will not proceed with this opportunity."
        },
        {
          "speaker": "m004",
          "turn": 2,
          "text": "We understand Priya's need for paid experience. Unfortunately, we cannot offer paid roles at this time, as our funding round has not yet closed. We appreciate her interest and wish her the best in finding a suitable opportunity."
        }
      ],
      "votes": {
        "m003": {
          "vote": "no",
          "reason": "The roles are unpaid, which conflicts with Priya's need for paid experience."
        },
        "m004": {
          "vote": "no",
          "reason": "Priya needs paid experience, which we cannot provide until our spring funding round closes."
        }
      },
      "result": "declined",
      "ai_generated": true,
      "introductions": []
    },
    {
      "id": "mt002",
      "a": "m007",
      "b": "m006",
      "candidate": {
        "a": "m007",
        "b": "m006",
        "fit": 1.043,
        "novelty": 0.356,
        "weight": 1.32,
        "cross_hub": true,
        "score": 1.52,
        "label": "complementary",
        "evidence": [
          {
            "need_of": "m007",
            "need": "brand launch strategy and packaging story for a new food product",
            "offer_of": "m006",
            "offer": "brand launch strategy and packaging story for food and beverage products",
            "similarity": 0.948
          },
          {
            "need_of": "m006",
            "need": "an early food or beverage brand to build from the start",
            "offer_of": "m007",
            "offer": "a new food brand with a product ready to launch and room for a first marketing hire",
            "similarity": 0.797
          }
        ]
      },
      "transcript": [
        {
          "speaker": "m007",
          "turn": 1,
          "text": "We at Oatwhistle Foods are a startup in food technology, making shelf-stable oat snacks in a shared kitchen. We need a brand launch strategy and packaging story for our new product, and a co-packer with a nut-free line. In return, we offer a new food brand with a product ready to launch and room for a first marketing hire, as well as tasting panels and recipe testing."
        },
        {
          "speaker": "m006",
          "turn": 1,
          "text": "I represent Marcus D., a brand marketer with eight years of experience in consumer food and beverage companies. He now freelances and wants to join an early team where he can shape a brand from the start. Marcus offers brand launch strategy and packaging story for food and beverage products, as well as naming and shelf placement experience."
        },
        {
          "speaker": "m007",
          "turn": 2,
          "text": "We would want to work with Marcus on a brand launch strategy and packaging story for our oat snacks, and we could offer him a role in our early team to shape the brand from the start."
        },
        {
          "speaker": "m006",
          "turn": 2,
          "text": "Marcus is open to part-time or project work, and he is looking for a founder who values packaging and storytelling. A call between the members would be worthwhile to discuss the details of the collaboration."
        }
      ],
      "votes": {
        "m007": {
          "vote": "yes",
          "reason": "Marcus directly addresses our need for a brand launch strategy and packaging story, and offers relevant experience."
        },
        "m006": {
          "vote": "yes",
          "reason": "Oatwhistle Foods directly addresses Marcus's need for a brand launch strategy and packaging story, and offers a role in an early team to shape the brand from the start."
        }
      },
      "result": "introduced",
      "ai_generated": true,
      "introductions": [
        {
          "meeting_id": "mt002",
          "to": "m007",
          "from_agent": "agent:m007",
          "message": "Marcus D., a brand marketer with eight years of experience in consumer food and beverage companies, now freelances and wants to join an early team where they can shape a brand from the start. They offer brand launch strategy and packaging story for food and beverage products, as well as naming and shelf placement experience. A call between you and Marcus would be worthwhile to discuss the details of the collaboration.",
          "ai_generated": true
        },
        {
          "meeting_id": "mt002",
          "to": "m006",
          "from_agent": "agent:m006",
          "message": "Oatwhistle Foods is a startup in food technology making shelf-stable oat snacks in a shared kitchen. They need a brand launch strategy and packaging story for their new product, and a co-packer with a nut-free line. In return, they offer a new food brand with a product ready to launch and room for a first marketing hire, as well as tasting panels and recipe testing. Marcus is open to part-time or project work, and he is looking for a founder who values packaging and storytelling. A call between the members would be worthwhile to discuss the details of the collaboration.",
          "ai_generated": true
        }
      ]
    },
    {
      "id": "mt003",
      "a": "m002",
      "b": "m001",
      "candidate": {
        "a": "m002",
        "b": "m001",
        "fit": 1.003,
        "novelty": 0.415,
        "weight": 1.24,
        "cross_hub": true,
        "score": 1.386,
        "label": "unexpected",
        "evidence": [
          {
            "need_of": "m002",
            "need": "a stamping plant for a paid pilot of camera inspection on a production line",
            "offer_of": "m001",
            "offer": "a stamping production line for pilots of camera inspection hardware",
            "similarity": 0.911
          },
          {
            "need_of": "m001",
            "need": "surface defect inspection for stamped parts",
            "offer_of": "m002",
            "offer": "camera surface defect inspection for stamped parts that mounts on a running line",
            "similarity": 0.84
          }
        ]
      },
      "transcript": [
        {
          "speaker": "m002",
          "turn": 1,
          "text": "We at Lumen Sight are a machine vision startup building cameras and software for factory inspection. We need a stamping plant for a paid pilot of our camera inspection on a production line, and we offer camera surface defect inspection for stamped parts that mounts on a running line, along with labelled defect image sets from earlier tests."
        },
        {
          "speaker": "m001",
          "turn": 1,
          "text": "We at Kestrel Stamping are a metal stamping supplier running three press lines for appliance and vehicle brackets. We need surface defect inspection for stamped parts and faster quoting on new die jobs. We offer a stamping production line for pilots of camera inspection hardware and prototype stamping runs of 500 to 5000 brackets."
        },
        {
          "speaker": "m002",
          "turn": 2,
          "text": "We would want the pilot to be no longer than twelve weeks. A call between our members would be worthwhile to discuss the details of the pilot and how our camera inspection can benefit your production line."
        },
        {
          "speaker": "m001",
          "turn": 2,
          "text": "We would want the pilot to be no longer than twelve weeks. A call between our members would be worthwhile to discuss the details of the pilot and how your camera inspection can benefit our production line."
        }
      ],
      "votes": {
        "m002": {
          "vote": "yes",
          "reason": "Kestrel Stamping directly addresses our need for a stamping plant for a paid pilot and offers a production line for pilots of camera inspection hardware."
        },
        "m001": {
          "vote": "yes",
          "reason": "Lumen Sight directly addresses Kestrel Stamping's need for surface defect inspection and offers a pilot within the desired timeframe."
        }
      },
      "result": "introduced",
      "ai_generated": true,
      "introductions": [
        {
          "meeting_id": "mt003",
          "to": "m002",
          "from_agent": "agent:m002",
          "message": "Kestrel Stamping is a metal stamping supplier running three press lines for appliance and vehicle brackets. They need surface defect inspection for stamped parts and faster quoting on new die jobs. The match is worth your time because they offer a stamping production line for pilots of camera inspection hardware and prototype stamping runs of 500 to 5000 brackets, which aligns with your need for a stamping plant for a paid pilot. A call between your members would be worthwhile to discuss the details of the pilot and how Lumen Sight's camera inspection can benefit their production line.",
          "ai_generated": true
        },
        {
          "meeting_id": "mt003",
          "to": "m001",
          "from_agent": "agent:m001",
          "message": "Lumen Sight is a machine vision startup building cameras and software for factory inspection. They need a stamping plant for a paid pilot of their camera inspection on a production line, and they offer camera surface defect inspection for stamped parts that mounts on a running line, along with labelled defect image sets from earlier tests. A call between your members would be worthwhile to discuss the details of the pilot and how their camera inspection can benefit your production line.",
          "ai_generated": true
        }
      ]
    },
    {
      "id": "mt004",
      "a": "m005",
      "b": "m008",
      "candidate": {
        "a": "m005",
        "b": "m008",
        "fit": 1.056,
        "novelty": 0.322,
        "weight": 1.0,
        "cross_hub": true,
        "score": 1.16,
        "label": "complementary",
        "evidence": [
          {
            "need_of": "m005",
            "need": "live shipment tracking for inbound parts across several plants",
            "offer_of": "m008",
            "offer": "live shipment tracking for inbound parts across several plants, tied to dispatch records",
            "similarity": 0.96
          },
          {
            "need_of": "m008",
            "need": "a large manufacturer to pilot live shipment tracking across several plants",
            "offer_of": "m005",
            "offer": "a multi-plant manufacturer pilot site with real inbound shipments",
            "similarity": 0.809
          }
        ]
      },
      "transcript": [
        {
          "speaker": "m005",
          "turn": 1,
          "text": "We at Great Lakes Mobility Group are a 4,000-person maker of vehicle components with plants across the region. Our supply chain still runs on spreadsheets and phone calls, and we need live shipment tracking for inbound parts across several plants, as well as a plant-floor tool that spots late supplier deliveries. We can offer a multi-plant manufacturer pilot site with real inbound shipments and introductions to our supplier network."
        },
        {
          "speaker": "m008",
          "turn": 1,
          "text": "We at Brindle Route are a four-person startup that builds software to track inbound shipments and warn plants about late parts. We need a large manufacturer to pilot live shipment tracking across several plants and a plant logistics lead to tell us what breaks."
        },
        {
          "speaker": "m005",
          "turn": 2,
          "text": "We would want a signed data agreement before any pilot. If you can provide that, we can discuss a pilot at our facilities."
        },
        {
          "speaker": "m008",
          "turn": 2,
          "text": "We would want a signed data agreement before any pilot. If you can provide that, we can discuss a pilot at your facilities."
        }
      ],
      "votes": {
        "m005": {
          "vote": "yes",
          "reason": "Brindle Route directly addresses our need for live shipment tracking across several plants and offers a pilot at their facilities."
        },
        "m008": {
          "vote": "yes",
          "reason": "Great Lakes Mobility Group directly addresses Brindle Route's need for a large manufacturer pilot and offers a signed data agreement as a condition."
        }
      },
      "result": "introduced",
      "ai_generated": true,
      "introductions": [
        {
          "meeting_id": "mt004",
          "to": "m005",
          "from_agent": "agent:m005",
          "message": "Brindle Route is a four-person startup that builds software to track inbound shipments and warn plants about late parts. They need a large manufacturer to pilot live shipment tracking across several plants and a plant logistics lead to tell them what breaks. The agents discussed the need for a signed data agreement before any pilot, and if provided, they can discuss a pilot at Great Lakes Mobility Group's facilities. The proposed next step is to provide the signed data agreement to move forward with the pilot.",
          "ai_generated": true
        },
        {
          "meeting_id": "mt004",
          "to": "m008",
          "from_agent": "agent:m008",
          "message": "Great Lakes Mobility Group is a 4,000-person maker of vehicle components with plants across the region. They need live shipment tracking for inbound parts across several plants, as well as a plant-floor tool that spots late supplier deliveries. The agents discussed a potential pilot at their facilities, with a signed data agreement as a prerequisite. You should draft and sign the data agreement, then schedule a detailed discussion about the pilot.",
          "ai_generated": true
        }
      ]
    },
    {
      "id": "mt005",
      "a": "m002",
      "b": "m005",
      "candidate": {
        "a": "m002",
        "b": "m005",
        "fit": 0.699,
        "novelty": 0.381,
        "weight": 1.0,
        "cross_hub": false,
        "score": 0.756,
        "label": "unexpected",
        "evidence": [
          {
            "need_of": "m002",
            "need": "a stamping plant for a paid pilot of camera inspection on a production line",
            "offer_of": "m005",
            "offer": "a multi-plant manufacturer pilot site with real inbound shipments",
            "similarity": 0.699
          }
        ]
      },
      "transcript": [
        {
          "speaker": "m002",
          "turn": 1,
          "text": "We at Lumen Sight are a six-person machine vision startup building cameras and software for factory inspection. We have run lab tests and are looking for our first customer production floor. We would like a stamping plant for a paid pilot of camera inspection on a production line, and an advisor who has sold software into factories. In return, we can offer camera surface defect inspection for stamped parts that mounts on a running line, as well as labelled defect image sets from earlier tests."
        },
        {
          "speaker": "m005",
          "turn": 1,
          "text": "We at Great Lakes Mobility Group are a 4,000-person maker of vehicle components with plants across the region. Our supply chain still runs on spreadsheets and phone calls. We pilot new tools with small teams and move carefully on contracts. We need live shipment tracking for inbound parts across several plants and a plant-floor tool that spots late supplier deliveries. We can offer a multi-plant manufacturer pilot site with real inbound shipments and introductions to our supplier network."
        },
        {
          "speaker": "m002",
          "turn": 2,
          "text": "We would want the pilot to be no longer than twelve weeks. A call between our members would be worthwhile, as you have a multi-plant manufacturer pilot site that matches our need for a stamping plant pilot."
        },
        {
          "speaker": "m005",
          "turn": 2,
          "text": "We would want a signed data agreement before the pilot. A call between our members would be worthwhile, as we can offer a multi-plant manufacturer pilot site with real inbound shipments."
        }
      ],
      "votes": {
        "m002": {
          "vote": "yes",
          "reason": "Great Lakes Mobility Group directly addresses our need for a stamping plant pilot and offers a multi-plant manufacturer pilot site."
        },
        "m005": {
          "vote": "yes",
          "reason": "Lumen Sight directly addresses our need for a stamping plant pilot and offers a solution that matches our requirements."
        }
      },
      "result": "introduced",
      "ai_generated": true,
      "introductions": [
        {
          "meeting_id": "mt005",
          "to": "m002",
          "from_agent": "agent:m002",
          "message": "Great Lakes Mobility Group is a 4,000-person maker of vehicle components with plants across the region. They pilot new tools with small teams and move carefully on contracts. They need live shipment tracking for inbound parts across several plants and a plant-floor tool that spots late supplier deliveries. In the meeting, they offered a multi-plant manufacturer pilot site with real inbound shipments and introductions to their supplier network. They would want a signed data agreement before the pilot. A call between your members would be worthwhile, as they can offer a multi-plant manufacturer pilot site that matches your need for a stamping plant pilot. The next step is to arrange a call between your members to discuss further.",
          "ai_generated": true
        },
        {
          "meeting_id": "mt005",
          "to": "m005",
          "from_agent": "agent:m005",
          "message": "Lumen Sight is a six-person machine vision startup building cameras and software for factory inspection. They have run lab tests and are looking for their first customer production floor. You can offer them a twelve-week pilot at one of your stamping plants, with a signed data agreement as a prerequisite. A call between your members would be worthwhile to explore this opportunity further.",
          "ai_generated": true
        }
      ]
    }
  ],
  "introductions": [
    {
      "meeting_id": "mt002",
      "to": "m007",
      "from_agent": "agent:m007",
      "message": "Marcus D., a brand marketer with eight years of experience in consumer food and beverage companies, now freelances and wants to join an early team where they can shape a brand from the start. They offer brand launch strategy and packaging story for food and beverage products, as well as naming and shelf placement experience. A call between you and Marcus would be worthwhile to discuss the details of the collaboration.",
      "ai_generated": true
    },
    {
      "meeting_id": "mt002",
      "to": "m006",
      "from_agent": "agent:m006",
      "message": "Oatwhistle Foods is a startup in food technology making shelf-stable oat snacks in a shared kitchen. They need a brand launch strategy and packaging story for their new product, and a co-packer with a nut-free line. In return, they offer a new food brand with a product ready to launch and room for a first marketing hire, as well as tasting panels and recipe testing. Marcus is open to part-time or project work, and he is looking for a founder who values packaging and storytelling. A call between the members would be worthwhile to discuss the details of the collaboration.",
      "ai_generated": true
    },
    {
      "meeting_id": "mt003",
      "to": "m002",
      "from_agent": "agent:m002",
      "message": "Kestrel Stamping is a metal stamping supplier running three press lines for appliance and vehicle brackets. They need surface defect inspection for stamped parts and faster quoting on new die jobs. The match is worth your time because they offer a stamping production line for pilots of camera inspection hardware and prototype stamping runs of 500 to 5000 brackets, which aligns with your need for a stamping plant for a paid pilot. A call between your members would be worthwhile to discuss the details of the pilot and how Lumen Sight's camera inspection can benefit their production line.",
      "ai_generated": true
    },
    {
      "meeting_id": "mt003",
      "to": "m001",
      "from_agent": "agent:m001",
      "message": "Lumen Sight is a machine vision startup building cameras and software for factory inspection. They need a stamping plant for a paid pilot of their camera inspection on a production line, and they offer camera surface defect inspection for stamped parts that mounts on a running line, along with labelled defect image sets from earlier tests. A call between your members would be worthwhile to discuss the details of the pilot and how their camera inspection can benefit your production line.",
      "ai_generated": true
    },
    {
      "meeting_id": "mt004",
      "to": "m005",
      "from_agent": "agent:m005",
      "message": "Brindle Route is a four-person startup that builds software to track inbound shipments and warn plants about late parts. They need a large manufacturer to pilot live shipment tracking across several plants and a plant logistics lead to tell them what breaks. The agents discussed the need for a signed data agreement before any pilot, and if provided, they can discuss a pilot at Great Lakes Mobility Group's facilities. The proposed next step is to provide the signed data agreement to move forward with the pilot.",
      "ai_generated": true
    },
    {
      "meeting_id": "mt004",
      "to": "m008",
      "from_agent": "agent:m008",
      "message": "Great Lakes Mobility Group is a 4,000-person maker of vehicle components with plants across the region. They need live shipment tracking for inbound parts across several plants, as well as a plant-floor tool that spots late supplier deliveries. The agents discussed a potential pilot at their facilities, with a signed data agreement as a prerequisite. You should draft and sign the data agreement, then schedule a detailed discussion about the pilot.",
      "ai_generated": true
    },
    {
      "meeting_id": "mt005",
      "to": "m002",
      "from_agent": "agent:m002",
      "message": "Great Lakes Mobility Group is a 4,000-person maker of vehicle components with plants across the region. They pilot new tools with small teams and move carefully on contracts. They need live shipment tracking for inbound parts across several plants and a plant-floor tool that spots late supplier deliveries. In the meeting, they offered a multi-plant manufacturer pilot site with real inbound shipments and introductions to their supplier network. They would want a signed data agreement before the pilot. A call between your members would be worthwhile, as they can offer a multi-plant manufacturer pilot site that matches your need for a stamping plant pilot. The next step is to arrange a call between your members to discuss further.",
      "ai_generated": true
    },
    {
      "meeting_id": "mt005",
      "to": "m005",
      "from_agent": "agent:m005",
      "message": "Lumen Sight is a six-person machine vision startup building cameras and software for factory inspection. They have run lab tests and are looking for their first customer production floor. You can offer them a twelve-week pilot at one of your stamping plants, with a signed data agreement as a prerequisite. A call between your members would be worthwhile to explore this opportunity further.",
      "ai_generated": true
    }
  ],
  "contrasts": [
    {
      "a": "m002",
      "b": "m005",
      "label": "contrast",
      "need_similarity": 0.69,
      "offer_similarity": 0.498,
      "shared_need": {
        "a": "a stamping plant for a paid pilot of camera inspection on a production line",
        "b": "a plant-floor tool that spots late supplier deliveries"
      },
      "approaches": {
        "a": "camera surface defect inspection for stamped parts that mounts on a running line",
        "b": "a multi-plant manufacturer pilot site with real inbound shipments"
      }
    }
  ],
  "weights_before": {
    "individual-startup|complementary": 1.32,
    "small_business-startup|unexpected": 1.24,
    "corporation-corporation|complementary": 0.76,
    "startup-startup|unexpected": 1.16,
    "individual-small_business|complementary": 1.16,
    "corporation-startup|complementary": 1.0,
    "corporation-small_business|unexpected": 0.84,
    "corporation-individual|complementary": 0.92,
    "individual-individual|unexpected": 0.92,
    "small_business-small_business|complementary": 1.16
  },
  "weights_after": {
    "individual-startup|complementary": 1.3,
    "small_business-startup|unexpected": 1.24,
    "corporation-corporation|complementary": 0.76,
    "startup-startup|unexpected": 1.16,
    "individual-small_business|complementary": 1.16,
    "corporation-startup|complementary": 1.0,
    "corporation-small_business|unexpected": 0.84,
    "corporation-individual|complementary": 0.92,
    "individual-individual|unexpected": 0.92,
    "small_business-small_business|complementary": 1.16
  },
  "ai_generated": true
};

"""Write the synthetic data files: profiles, history, weights and the planted demo pairs.

Everything is hand-authored literal data plus fixed rules, so running it twice gives
byte-identical files. All people and organisations are invented.

    python scripts/generate_data.py [--out DIR]
"""

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from warmintro.feedback import derive_weights  # noqa: E402

HUBS = ("ann_arbor", "detroit", "grand_rapids")
ALL_PERMS = {"share_profile": True, "propose_meetings": True, "contact_member": True}


def _m(type_, name, sector, description, needs, offers, deal_breakers, budget=2, hub=None, demo=False):
    return {
        "type": type_, "name": name, "hub": hub, "sector": sector, "description": description,
        "needs": needs, "offers": offers, "deal_breakers": deal_breakers, "intro_budget": budget,
        "demo": demo,
    }


# Demo members m001-m008. The live demo and the mock agents speak from these words, so the
# planted pairs share vocabulary on purpose (see data/demo.json and tests/test_data.py).
DEMO = [
    _m("small_business", "Kestrel Stamping", "metal stamping",
       "Kestrel Stamping is a 60-person metal stamping supplier running three press lines for appliance and vehicle brackets. "
       "Surface defects found late cost us scrap and rework. We prefer short, direct agreements and long supplier relationships.",
       ["surface defect inspection for stamped parts", "faster quoting on new die jobs"],
       ["a stamping production line for pilots of camera inspection hardware", "prototype stamping runs of 500 to 5000 brackets"],
       ["unpaid trials", "stopping production for installs"], 2, "grand_rapids", True),
    _m("startup", "Lumen Sight", "machine vision",
       "Lumen Sight is a six-person machine vision startup that builds cameras and software for factory inspection. "
       "We have run lab tests and are looking for our first customer production floor.",
       ["a stamping plant for a paid pilot of camera inspection on a production line", "an advisor who has sold software into factories"],
       ["camera surface defect inspection for stamped parts that mounts on a running line", "labelled defect image sets from earlier tests"],
       ["sharing our source code", "pilots longer than twelve weeks"], 2, "detroit", True),
    _m("individual", "Priya N.", "computer science student",
       "Priya is a master's student in computer science who focuses on robotics and path planning. "
       "She wants hands-on engineering work that fits around her classes and pays for her time. "
       "Her coursework includes route planning software for small autonomous machines.",
       ["a hands-on flight software role on a small drone team", "paid engineering experience that fits around classes"],
       ["robotics student who can engineer flight path planning software 15 hours a week", "path planning coursework and simulation code"],
       ["unpaid roles", "full-time hours during the semester"], 2, "ann_arbor", True),
    _m("startup", "Tern Aerial", "drones",
       "Tern Aerial builds inspection drones for bridges and wind turbines with a team of five. "
       "We are between funding rounds and cannot pay salaries until the spring round closes.",
       ["a student engineer for flight path planning software", "a bridge owner to host inspection flights"],
       ["hands-on flight software roles on a small drone team", "equity in the company, with the first roles unpaid until the spring round"],
       ["paying full price before a working demo", "handing over our flight logs"], 2, "detroit", True),
    _m("corporation", "Great Lakes Mobility Group", "automotive",
       "Great Lakes Mobility Group is a 4,000-person maker of vehicle components with plants across the region. "
       "Our supply chain still runs on spreadsheets and phone calls. We pilot new tools with small teams and move carefully on contracts.",
       ["live shipment tracking for inbound parts across several plants", "a plant-floor tool that spots late supplier deliveries"],
       ["a multi-plant manufacturer pilot site with real inbound shipments", "introductions to our supplier network"],
       ["pilots without a signed data agreement", "startups without a security audit"], 3, "detroit", True),
    _m("individual", "Marcus D.", "brand marketing",
       "Marcus is a brand marketer with eight years at consumer food and beverage companies who now freelances. "
       "He wants to join an early team where he can shape a brand from the start. He is open to part-time or project work.",
       ["an early food or beverage brand to build from the start", "a founder who values packaging and storytelling"],
       ["brand launch strategy and packaging story for food and beverage products", "naming and shelf placement experience"],
       ["exclusivity that blocks other clients", "equity as the only pay"], 2, "grand_rapids", True),
    _m("startup", "Oatwhistle Foods", "food technology",
       "Oatwhistle Foods makes shelf-stable oat snacks in a shared kitchen with a team of four. "
       "The product is ready to launch and we have no marketing person yet.",
       ["brand launch strategy and packaging story for a new food product", "a co-packer with a nut-free line"],
       ["a new food brand with a product ready to launch and room for a first marketing hire", "tasting panels and recipe testing"],
       ["dropping our organic certification", "minimum orders above ten pallets"], 2, "ann_arbor", True),
    _m("startup", "Brindle Route", "supply chain software",
       "Brindle Route is a four-person startup founded by two former dispatchers. "
       "We build software that tracks inbound shipments and warns plants about late parts, and we have only tested it on small fleets.",
       ["a large manufacturer to pilot live shipment tracking across several plants", "a plant logistics lead who will tell us what breaks"],
       ["live shipment tracking for inbound parts across several plants, tied to dispatch records", "late delivery alerts for plant schedulers"],
       ["exclusive contracts", "building custom features for free"], 2, "grand_rapids", True),
]

INDIVIDUALS = [
    _m("individual", "Devon K.", "industrial design student",
       "Devon is a senior in industrial design who builds furniture prototypes in a campus shop. "
       "Devon is searching for a maker who can build a thesis chair.",
       ["a furniture maker to build a thesis chair prototype", "feedback from a working product designer"],
       ["parametric chair modelling and rendering", "wood joinery drawings"],
       ["owning no credit for the design"], 2),
    _m("individual", "Amara O.", "nursing informatics",
       "Amara is a nurse with ten years on hospital floors who moved into health informatics. "
       "She reviews how digital tools fit real clinical routines.",
       ["a startup that wants a clinical workflow review of a patient app", "a clinic willing to trial a refill reminder app"],
       ["bedside workflow review from ten years of nursing", "plain-language patient handout writing"],
       ["tools that store patient names"], 1),
    _m("individual", "Tomas R.", "welding fabrication",
       "Tomas is a journeyman welder who wants to learn programming for welding robots. "
       "He works days at a fabrication shop and studies at night.",
       ["training on robotic weld cell programming", "a mentor who has commissioned a welding robot"],
       ["journeyman TIG welding on stainless and aluminum", "weld inspection and fit-up checks"],
       ["night shifts only"], 2),
    _m("individual", "Hannah S.", "plant science student",
       "Hannah studies plant science and runs a small soil lab on campus. She wants her thesis work grounded in real farms.",
       ["farm plots for cover crop field trials", "a grower who will share harvest records"],
       ["soil sampling and nutrient lab analysis", "cover crop seed mix planning"],
       ["trials that skip permission from landowners"], 2),
    _m("individual", "Wei L.", "software engineering",
       "Wei is a backend engineer at a mid-size software company who wants to move toward devices and embedded work. "
       "He codes mostly in Go and ships on weekends.",
       ["a mentor in embedded firmware for sensors", "a hardware team that needs a cloud data pipeline"],
       ["backend API development in Go", "database schema design for telemetry"],
       ["weekday hours"], 2),
    _m("individual", "Jasmine P.", "accounting student",
       "Jasmine is an accounting major who tutors spreadsheet modelling. She would like to see how a factory tracks the cost of each part.",
       ["an internship in manufacturing cost accounting", "an owner who will explain standard costing"],
       ["spreadsheet modelling and bookkeeping clean-up", "monthly close checklists"],
       ["handling cash"], 1),
    _m("individual", "Luis M.", "freight dispatch",
       "Luis dispatches trucks for a regional carrier and wants to start his own cold-chain trucking company. "
       "He knows the lanes between the three metro areas well.",
       ["produce shippers who need refrigerated loads", "a financing partner for a reefer trailer"],
       ["dispatch scheduling for refrigerated freight", "driver recruiting and route planning"],
       ["loads without a signed rate sheet"], 2),
    _m("individual", "Nora B.", "middle school science teacher",
       "Nora teaches eighth-grade science and runs the robotics club. Her classroom lacks kits and she wants students to meet working engineers.",
       ["classroom robotics kits donated by manufacturers", "engineers to visit the robotics club"],
       ["science curriculum writing and lesson piloting", "classroom feedback on student software"],
       ["tools that need student email accounts"], 2),
    _m("individual", "Ethan C.", "mechanical engineering student",
       "Ethan leads the suspension team on his university's student racing project. The team has simulations but little machining budget.",
       ["sponsored machining of suspension uprights", "a mentor who reviews vehicle dynamics models"],
       ["finite element analysis of racing parts", "sponsor logo placement and event exposure"],
       ["parts delivered after the race season"], 2),
    _m("individual", "Fatima A.", "grant writing",
       "Fatima writes federal and state grant applications for workforce training programs. She enjoys projects where an employer commits to hiring.",
       ["a manufacturer ready to co-sponsor a workforce training grant", "program data on trainee outcomes"],
       ["federal and state workforce grant writing", "budget narrative drafting"],
       ["fees paid only if funded"], 2),
    _m("individual", "Greg V.", "quality engineering",
       "Greg is a quality engineer between jobs who audited suppliers for twenty years. He is selective about who contacts him.",
       ["a small plant that wants help with audit readiness", "a part-time consulting client"],
       ["ISO 9001 audit preparation and corrective action coaching", "supplier scorecard design"],
       ["on-site work more than two days a week"], 1),
    _m("individual", "Sofia T.", "data science student",
       "Sofia is a data science student who builds forecasting models in Python. She needs real business data instead of class datasets.",
       ["a retail dataset of weekly orders", "a shop owner who will try demand forecasts"],
       ["demand forecasting models in Python", "dashboard prototypes in a notebook"],
       ["data she must sign away"], 2),
    _m("individual", "Ravi J.", "usability research",
       "Ravi runs usability studies for software teams and has recently worked on health apps. He likes interviews with real users.",
       ["a health startup that needs usability testing", "access to clinic staff for interviews"],
       ["usability testing and interview studies", "onboarding flow critique"],
       ["studies with no budget for participants"], 2),
]

STARTUPS = [
    _m("startup", "Marrowbright Health", "digital health",
       "Marrowbright Health is a five-person startup making a phone app that reminds chronic care patients about refills. "
       "We need a clinic to try it and tell us what staff think.",
       ["a clinic to trial refill reminders for chronic care patients", "a nurse to review the app against bedside workflow"],
       ["medication refill reminder app with pharmacy tracking", "plain-language patient messaging templates"],
       ["selling patient lists"], 2),
    _m("startup", "Slagwell Recovery", "industrial sustainability",
       "Slagwell Recovery cleans and reuses used casting sand in a trailer-mounted unit. The founders are two metallurgists.",
       ["a foundry to host a sand reclamation pilot", "a landfill-fee comparison from an aluminum caster"],
       ["foundry sand reclamation that cuts landfill fees", "monthly sand quality reports"],
       ["pilots that move waste off-site"], 2),
    _m("startup", "Cobblestone Learning", "education technology",
       "Cobblestone Learning makes adaptive math practice for grades six to eight. We have two teachers on staff and test in a few classrooms.",
       ["middle school science teachers to review lesson links", "a district that will pilot adaptive math practice"],
       ["adaptive math practice software for grades six to eight", "teacher dashboards for skill gaps"],
       ["selling student data"], 2),
    _m("startup", "Voltpetal", "energy storage",
       "Voltpetal repacks used electric vehicle batteries into backup power units. Our lab is small and our test bench is booked.",
       ["cell testing lab time", "a utility to host a backup battery test"],
       ["second-life battery packs for backup power", "state-of-health reports on used cells"],
       ["warranty claims without testing records"], 2),
    _m("startup", "Heron Harvest Robotics", "agricultural robotics",
       "Heron Harvest Robotics builds soft-gripper arms that pick berries without bruising. Prototypes work in the lab but have never seen a real field.",
       ["orchard and berry farms to test picking arms during harvest", "a grower who will share yield and bruising data"],
       ["gentle robotic berry picking arms", "harvest timing analytics"],
       ["testing outside daylight hours"], 2),
    _m("startup", "Quartzfold", "business software",
       "Quartzfold builds invoice matching software for small manufacturers and distributors. The two founders came from accounts payable.",
       ["a bookkeeping expert to shape invoice review screens", "a machine shop that will test scanned invoice reading"],
       ["invoice matching software that reads scanned PDFs", "automatic coding of vendor bills"],
       ["storing bank logins"], 2),
    _m("startup", "Ledgerwren", "financial technology",
       "Ledgerwren forecasts cash flow for small shops and studios. We are a team of three with a bank-style dashboard and no lender yet.",
       ["a lending partner for shops that need working capital", "a shop owner who will share monthly sales"],
       ["cash flow forecasting for small shops", "late payment warnings for owners"],
       ["lender exclusivity"], 2),
    _m("startup", "Moxhollow Print", "industrial 3D printing",
       "Moxhollow Print makes sand molds on a large printer for parts that need only a few castings. We have printed samples but few foundry customers.",
       ["a metal casting customer for printed sand molds", "a quality engineer to review dimensional checks"],
       ["3D printed sand molds for short run castings", "pattern-free prototype castings in a week"],
       ["orders without drawings"], 2),
    _m("startup", "Kelpline Packaging", "sustainable packaging",
       "Kelpline Packaging makes compostable food trays from seaweed. The trays pass lab tests and need a real food customer.",
       ["a food processor to trial compostable trays", "a packaging converter to run die cuts"],
       ["compostable seaweed-based food trays", "shelf-life test data on tray materials"],
       ["plastic liners"], 2),
    _m("startup", "Borealine Voice", "voice technology",
       "Borealine Voice builds a headset assistant that lets operators log downtime by speaking. We work in noisy plants and want to hear how it performs.",
       ["a plant manager to test spoken downtime logging", "recordings of real machine noise"],
       ["hands-free voice logging of shop floor downtime", "noise-tolerant speech models"],
       ["recording conversations without notice"], 2),
    _m("startup", "Cinderlark Energy", "energy monitoring",
       "Cinderlark Energy sells clip-on sensors that find wasted heat in industrial kitchens and bakeries. Three engineers, one pilot customer.",
       ["bakeries and kitchens with large ovens to test heat sensors", "a utility rebate contact"],
       ["oven energy monitoring that flags waste heat", "monthly savings reports"],
       ["site visits without notice"], 2),
]

SMALL_BUSINESSES = [
    _m("small_business", "Ridgeback Tool & Die", "tool and die manufacturing",
       "Ridgeback Tool & Die designs and builds progressive dies for tight tolerance parts with a staff of 35. Wire EDM skills are hard to hire.",
       ["young machinists trained on wire EDM", "faster steel hardening turnaround"],
       ["progressive die design and build for tight tolerance parts", "die repair within three days"],
       ["rush jobs with no drawings"], 2),
    _m("small_business", "Alderfield Plastics", "injection molding",
       "Alderfield Plastics runs injection molding presses for housings and clips with 50 employees. Resin prices swing and customers ask about recycled content.",
       ["recycled-content resin for housings", "mold flow simulation for thin walls"],
       ["injection molding runs up to 200,000 housings", "mold maintenance with a one-day turnaround"],
       ["resin shipped without certificates"], 2),
    _m("small_business", "Copperkettle Castings", "aluminum casting",
       "Copperkettle Castings is a family-owned aluminum foundry with 40 people. Disposal of used sand is our growing cost.",
       ["reuse of spent sand from our casting floor to avoid landfill fees", "prototype molds without waiting on pattern shops"],
       ["low-pressure aluminum castings for pumps and housings", "pattern storage for returning customers"],
       ["contracts that bar other buyers"], 2),
    _m("small_business", "Birchbark Furniture", "office furniture manufacturing",
       "Birchbark Furniture builds walnut and maple conference tables for offices and schools with 25 woodworkers. Hardwood supply is irregular.",
       ["hardwood lumber from managed woodlots", "a designer for a lighter modular desk"],
       ["custom walnut conference tables", "furniture refinishing for schools"],
       ["lumber with no origin papers"], 2),
    _m("small_business", "Longacre Bakehouse", "food processing",
       "Longacre Bakehouse produces frozen dough and laminated pastry for grocers with 70 staff. Ovens run all night and energy is our largest bill.",
       ["lower oven energy bills", "a trucker for early morning grocery runs"],
       ["frozen dough and laminated pastry production for grocers", "bakery test kitchen time for new recipes"],
       ["allergen mix-ups"], 2),
    _m("small_business", "Thistledown Berry Farm", "agriculture",
       "Thistledown Berry Farm grows blueberries and raspberries on 90 acres near the lake. Pickers are hard to find in July.",
       ["robotic arms to pick berries during the July harvest", "a cold storage partner"],
       ["test acreage for orchard and berry robots", "fresh-pick quality scoring by the pallet"],
       ["machines that crush fruit"], 2),
    _m("small_business", "Pinegate Machining", "CNC machining",
       "Pinegate Machining makes milled and turned parts with 22 staff and several five-axis machines. We want to grow our own machinists.",
       ["apprentices for CNC machining", "a software tool to schedule spindle hours"],
       ["CNC machining apprenticeship with paid first year", "prototype and racing parts machined at cost for students"],
       ["unpaid apprenticeships"], 2),
    _m("small_business", "Cordwain Packaging", "corrugated packaging manufacturing",
       "Cordwain Packaging cuts corrugated boxes and inserts for food and parts customers with 45 staff. Customers ask for greener trays.",
       ["compostable tray options for food customers", "a faster die cut setup process"],
       ["custom corrugated boxes and die cut inserts", "warehouse kitting for small brands"],
       ["jobs under 500 boxes"], 2),
    _m("small_business", "Greywing Studio", "industrial design",
       "Greywing Studio is a six-person design studio doing product concepts, packaging graphics and 3D visuals for makers. We prefer working with manufacturers.",
       ["industrial clients for product renderings", "a materials expert who knows molded fibre"],
       ["industrial design, 3D visuals and packaging graphics", "design sprints for new product lines"],
       ["work with no creative credit"], 2),
    _m("small_business", "Ottertail Trucking", "logistics",
       "Ottertail Trucking runs eight refrigerated trucks between the three metro areas. Empty return trips eat our margin.",
       ["return loads of produce from farms to cities", "driver apps that file paperwork"],
       ["refrigerated trucking between the three metro areas", "dock-to-dock delivery windows"],
       ["loads over 44,000 pounds"], 2),
    _m("small_business", "Wrenfield Accounting", "accounting and tax",
       "Wrenfield Accounting keeps books and prepares taxes for machine shops and farms. We still key in vendor invoices by hand.",
       ["less hand keying of vendor invoices", "interns who like cost accounting"],
       ["bookkeeping and tax preparation for machine shops", "year-end inventory counts"],
       ["clients who pay in cash only"], 2),
    _m("small_business", "Saltmarsh Brewing", "craft brewery",
       "Saltmarsh Brewing is a taproom brewery with 12 employees and a large event room. Spent grain piles up weekly.",
       ["buyers for spent grain", "a bottle supplier with short lead times"],
       ["taproom event space for startup demos", "limited-run beers for corporate events"],
       ["events after midnight"], 1),
    _m("small_business", "Nutmeg Wire & Cable", "wire harness manufacturing",
       "Nutmeg Wire & Cable assembles wire harnesses for e-bike and tractor makers with 55 workers. Test fixtures are slow and handmade.",
       ["automated harness testing fixtures", "crimp tool maintenance training"],
       ["wire harness assembly for e-bike and tractor makers", "connector sourcing for small runs"],
       ["engineering changes after release"], 2),
    _m("small_business", "Ironwillow Fabrication", "metal fabrication",
       "Ironwillow Fabrication welds stainless equipment for kitchens and dairies with 30 employees. Welders are scarce and robots are new to us.",
       ["a robotic welding programmer", "a sheet metal laser cutting partner"],
       ["stainless fabrication for food equipment", "orbital welding of sanitary tube"],
       ["carbon steel only jobs"], 2),
]

CORPORATIONS = [
    _m("corporation", "Amberline Appliance Components", "appliance component manufacturing",
       "Amberline Appliance Components supplies motor housings and brackets to appliance makers from three plants. Recycled content targets are tightening.",
       ["a supplier of recycled aluminum castings", "a second source for stamped steel brackets"],
       ["volume purchase contracts for brackets and housings", "ramp-up engineering support for new suppliers"],
       ["suppliers without quality certificates"], 3),
    _m("corporation", "Tallgrass Dairy Cooperative", "dairy processing",
       "Tallgrass Dairy Cooperative collects milk from 200 farms and makes cheese and butter. Our trucking is stretched across lower Michigan.",
       ["refrigerated trucking for cheese pallets", "cold-room sensors for aging caves"],
       ["milk and cheese supply contracts for grocers", "farm visits for food startups"],
       ["uncooled shipments"], 3),
    _m("corporation", "Northmarsh Learning Group", "education and training",
       "Northmarsh Learning Group runs job training and tutoring programs across forty school districts. We look for software that teachers will actually use.",
       ["adaptive math practice for middle school", "a skills assessment tool for adult learners"],
       ["teacher training network across forty districts", "classroom pilots with feedback surveys"],
       ["tools that cannot export grades"], 3),
    _m("corporation", "Brightfen Health Network", "healthcare",
       "Brightfen Health Network runs twelve clinics and a small hospital. Missed appointments waste staff time every week.",
       ["reminder tools to cut missed appointments", "an intake kiosk that reads insurance cards"],
       ["clinic sites for digital health pilots", "nurse advisors for workflow review"],
       ["apps that store records outside the network"], 3),
    _m("corporation", "Stonebridge Credit Union", "financial services",
       "Stonebridge Credit Union serves 80,000 members including many small shops. Small business lending is our growth line.",
       ["cash flow data from small manufacturers", "a fraud scoring tool for card payments"],
       ["small business credit lines with fast approval", "branch space for financial workshops"],
       ["loan referrals with fees"], 3),
    _m("corporation", "Harborlight Energy", "electric utility",
       "Harborlight Energy delivers power to 600,000 customers and owns substations with spare land. Storage is our biggest planning question.",
       ["grid battery storage pilots", "heat-loss sensing for commercial kitchens"],
       ["pilot sites on substation land", "rebate programs for efficiency upgrades"],
       ["equipment without safety listings"], 2),
    _m("corporation", "Ferrous Crest Steel Service", "steel service center",
       "Ferrous Crest Steel Service slits and cuts coil for stamping shops from two warehouses. Counting inventory by hand is slow.",
       ["automatic coil inventory counting", "a returns process for scrapped coil"],
       ["cut-to-length steel coil for stamping shops", "next-day delivery on standard gauges"],
       ["orders without purchase numbers"], 3),
    _m("corporation", "Pelham Office Furnishings", "furniture manufacturing",
       "Pelham Office Furnishings builds desks and seating for schools and campuses from two factories. Buyers now ask for responsibly sourced wood.",
       ["responsibly sourced hardwood and recycled steel", "a refinishing partner for returned desks"],
       ["bulk furniture orders for schools and campuses", "showroom space for new designers"],
       ["materials with no traceability"], 3),
    _m("corporation", "Gantry Freight Holdings", "warehousing and rail logistics",
       "Gantry Freight Holdings runs warehouses beside the Detroit rail yard. Truck queues at our docks are growing.",
       ["dock scheduling software", "container yard cameras"],
       ["warehouse space near the rail yard", "rail to truck transfer service"],
       ["unannounced dock arrivals"], 2),
    _m("corporation", "Redwater Foods", "food processing",
       "Redwater Foods cans and freezes vegetables for store brands from four plants. Our tray plastic is a sustainability target.",
       ["compostable packaging for frozen vegetables", "line-speed vision checks for cans"],
       ["private label canned vegetable contracts", "plant tours for packaging startups"],
       ["packaging that taints flavor"], 3),
    _m("corporation", "Quillon Software", "enterprise software",
       "Quillon Software sells scheduling and billing systems to hospitals and utilities. We hire interns every summer and struggle to find firmware talent.",
       ["interns who know embedded firmware", "usability research for our billing screens"],
       ["enterprise scheduling software licenses", "summer internships with mentors"],
       ["unlicensed use of our code"], 3),
    _m("corporation", "Brackenridge Design & Architecture", "architecture and design",
       "Brackenridge Design & Architecture plans factories, schools and offices with 300 staff. Clients ask to walk through a building before it is built.",
       ["visualization tools for client walk-throughs", "a molded fibre acoustic panel maker"],
       ["architecture and interiors for plants and offices", "site planning for new factories"],
       ["fixed-fee jobs with open scope"], 3),
    _m("corporation", "Cresswell Recycling Industries", "plastics recycling",
       "Cresswell Recycling Industries sorts and melts used plastic into resin pellets at two plants. We want more molders as customers.",
       ["molders who will test recycled polypropylene resin", "sorting cameras for mixed plastic"],
       ["recycled polypropylene resin pellets", "material test sheets for molders"],
       ["contaminated feedstock"], 3),
    _m("corporation", "Ashgrove Transit Technologies", "public transit technology",
       "Ashgrove Transit Technologies equips bus fleets in two cities with scheduling and payment systems. Ridership counts are still manual.",
       ["rider counting sensors for buses", "a rural route demand model"],
       ["bus fleet test routes in two cities", "transit schedule data feeds"],
       ["hardware that blocks the driver view"], 3),
]

# One non-demo member in each list must restrict how agents may act for them.
RESTRICTED = {"Greg V.": {"contact_member": False}, "Harborlight Energy": {"propose_meetings": False}}

# (a, b, label, outcome, date): ids are by name. Skewed so each kind|label drifts differently.
H = [
    ("Ravi J.", "Marrowbright Health", "complementary", "hire", "2026-01-12"),
    ("Wei L.", "Borealine Voice", "complementary", "hire", "2026-02-03"),
    ("Sofia T.", "Ledgerwren", "complementary", "hire", "2026-03-09"),
    ("Hannah S.", "Heron Harvest Robotics", "complementary", "hire", "2026-04-14"),
    ("Devon K.", "Moxhollow Print", "complementary", "no_follow_up", "2026-05-06"),
    ("Jasmine P.", "Quartzfold", "complementary", "hire", "2026-06-17"),
    ("Pinegate Machining", "Cinderlark Energy", "unexpected", "pilot", "2026-01-20"),
    ("Longacre Bakehouse", "Cinderlark Energy", "unexpected", "pilot", "2026-02-18"),
    ("Copperkettle Castings", "Slagwell Recovery", "unexpected", "pilot", "2026-03-24"),
    ("Alderfield Plastics", "Kelpline Packaging", "unexpected", "pilot", "2026-05-27"),
    ("Saltmarsh Brewing", "Borealine Voice", "unexpected", "no_follow_up", "2026-07-08"),
    ("Amberline Appliance Components", "Stonebridge Credit Union", "complementary", "no_follow_up", "2026-01-28"),
    ("Tallgrass Dairy Cooperative", "Gantry Freight Holdings", "complementary", "no_follow_up", "2026-03-02"),
    ("Pelham Office Furnishings", "Brackenridge Design & Architecture", "complementary", "no_follow_up", "2026-04-21"),
    ("Redwater Foods", "Quillon Software", "complementary", "no_follow_up", "2026-06-10"),
    ("Brightfen Health Network", "Northmarsh Learning Group", "complementary", "partnership", "2026-08-05"),
    ("Harborlight Energy", "Voltpetal", "complementary", "pilot", "2026-02-26"),
    ("Brightfen Health Network", "Marrowbright Health", "complementary", "pilot", "2026-04-30"),
    ("Redwater Foods", "Kelpline Packaging", "complementary", "no_follow_up", "2026-07-22"),
    ("Cresswell Recycling Industries", "Moxhollow Print", "complementary", "no_follow_up", "2026-09-15"),
    ("Tomas R.", "Ironwillow Fabrication", "complementary", "hire", "2026-02-11"),
    ("Ethan C.", "Pinegate Machining", "complementary", "hire", "2026-05-19"),
    ("Devon K.", "Birchbark Furniture", "complementary", "hire", "2026-07-14"),
    ("Greg V.", "Ridgeback Tool & Die", "complementary", "no_follow_up", "2026-09-02"),
    ("Ferrous Crest Steel Service", "Wrenfield Accounting", "unexpected", "no_follow_up", "2026-03-16"),
    ("Cresswell Recycling Industries", "Nutmeg Wire & Cable", "unexpected", "partnership", "2026-05-12"),
    ("Ashgrove Transit Technologies", "Ottertail Trucking", "unexpected", "no_follow_up", "2026-08-19"),
    ("Pelham Office Furnishings", "Greywing Studio", "unexpected", "no_follow_up", "2026-10-06"),
    ("Nora B.", "Fatima A.", "unexpected", "partnership", "2026-04-08"),
    ("Hannah S.", "Luis M.", "unexpected", "no_follow_up", "2026-06-25"),
    ("Sofia T.", "Wei L.", "unexpected", "no_follow_up", "2026-09-23"),
    ("Slagwell Recovery", "Cobblestone Learning", "unexpected", "partnership", "2026-02-09"),
    ("Voltpetal", "Quartzfold", "unexpected", "partnership", "2026-04-02"),
    ("Heron Harvest Robotics", "Ledgerwren", "unexpected", "partnership", "2026-06-30"),
    ("Cobblestone Learning", "Borealine Voice", "unexpected", "no_follow_up", "2026-08-27"),
    ("Amara O.", "Quillon Software", "complementary", "hire", "2026-03-30"),
    ("Fatima A.", "Northmarsh Learning Group", "complementary", "no_follow_up", "2026-07-01"),
    ("Tomas R.", "Ferrous Crest Steel Service", "complementary", "no_follow_up", "2026-10-13"),
    ("Birchbark Furniture", "Cordwain Packaging", "complementary", "partnership", "2026-05-05"),
    ("Ridgeback Tool & Die", "Nutmeg Wire & Cable", "complementary", "partnership", "2026-08-12"),
]


def build_members() -> list[dict]:
    members = []
    non_demo = INDIVIDUALS + STARTUPS + SMALL_BUSINESSES + CORPORATIONS
    for i, raw in enumerate(DEMO + non_demo):
        member = dict(raw)
        if member["hub"] is None:
            member["hub"] = HUBS[(i - len(DEMO)) % 3]
        demo = member.pop("demo")
        permissions = {**ALL_PERMS, **RESTRICTED.get(member["name"], {})}
        out = {"id": f"m{i + 1:03d}", "type": member.pop("type"), "name": member.pop("name"), "hub": member.pop("hub"),
               "sector": member.pop("sector"), "description": member.pop("description"), "needs": member.pop("needs"),
               "offers": member.pop("offers"), "deal_breakers": member.pop("deal_breakers"),
               "intro_budget": member.pop("intro_budget"), "permissions": permissions}
        if demo:
            out["demo"] = True
        members.append(out)
    return members


def build_history(members: list[dict]) -> list[dict]:
    by_name = {m["name"]: m for m in members}
    connections = []
    for n, (a_name, b_name, label, outcome, date) in enumerate(sorted(H, key=lambda r: r[4]), start=1):
        a, b = by_name[a_name], by_name[b_name]
        connections.append({
            "id": f"h{n:03d}", "a": a["id"], "b": b["id"],
            "kind": "-".join(sorted([a["type"], b["type"]])), "label": label,
            "cross_hub": a["hub"] != b["hub"], "outcome": outcome, "date": date,
        })
    return connections


def build_demo(members: list[dict]) -> dict:
    ids = {m["name"]: m["id"] for m in members}
    return {
        "synthetic": True,
        "member_ids": [m["id"] for m in members if m.get("demo")],
        "yes_pairs": [
            [ids["Kestrel Stamping"], ids["Lumen Sight"]],
            [ids["Marcus D."], ids["Oatwhistle Foods"]],
            [ids["Great Lakes Mobility Group"], ids["Brindle Route"]],
        ],
        "no_pair": [ids["Tern Aerial"], ids["Priya N."]],
    }


def render(payload: object) -> str:
    return json.dumps(payload, indent=2, ensure_ascii=False) + "\n"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, default=ROOT / "data", help="output directory (default: data/)")
    out = parser.parse_args().out
    out.mkdir(parents=True, exist_ok=True)

    members = build_members()
    history = build_history(members)
    files = {
        "profiles.json": {"synthetic": True, "members": members},
        "history.json": {"synthetic": True, "connections": history},
        "weights.json": derive_weights(history),
        "demo.json": build_demo(members),
    }
    for name, payload in files.items():
        (out / name).write_text(render(payload), encoding="utf-8")
    print(f"wrote {len(members)} members, {len(history)} connections to {out}")


if __name__ == "__main__":
    main()

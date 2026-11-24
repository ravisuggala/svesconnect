// Single source of truth for the equipment registration form (served to the UI, used for validation).
// Based on "SVES Equipment Registration Templates" + the sample equipment format + brochure pages.
// Field: { key, label, type, options?, required?, help?, unit?, showIf?, highValue? }
// types: text | textarea | number | date | select | yesno | url | email | tel | list | kv
const HIGH_VALUE_LAKHS = 1.5; // "High-value equipment" threshold in the template (₹1.5 Lakhs)

const f = (key, label, type = "text", extra = {}) => ({ key, label, type, ...extra });
const sel = (key, label, options, extra = {}) => f(key, label, "select", { options, ...extra });
const yn = (key, label, extra = {}) => f(key, label, "yesno", extra);
const when = (key, value) => ({ key, equals: value });

const BASE_SECTIONS = [
  { key: "basic", title: "Basic information", fields: [
    f("manufacturer", "Manufacturer"),
    f("model", "Model"),
    f("serial_no", "Serial number", "text", { help: "Used for search and QR labels." }),
    f("description", "Description", "textarea", { help: "What the equipment does, in two or three sentences." }),
    f("key_features", "Key features", "textarea"),
    f("reference_website", "Reference website", "url", { placeholder: "https://" }),
    f("installation_date", "Date of installation", "date"),
    f("equipment_cost_lakhs", "Equipment cost", "number", { unit: "₹ lakhs", help: "Equipment above ₹1.5 lakh is high-value and asks for the full financial and training details." }),
    f("applications", "Applications", "list", { help: "One application per line, for example “Prototyping & product design”." }),
    f("working_steps", "How it works (steps)", "list", { help: "One step per line, as shown in the equipment handbook." }),
  ] },
  { key: "financial", title: "Financial & procurement", fields: [
    f("vendor_name", "Vendor / supplier name"),
    f("vendor_email", "Vendor email", "email"),
    f("vendor_phone", "Vendor phone", "tel"),
    sel("funding_source", "Funding source", ["Government Grant", "Institute Budget", "Industry", "CSR", "Other"]),
    f("po_number", "Purchase order number", "text", { highValue: true }),
    f("invoice_number", "Invoice number", "text", { highValue: true }),
    f("invoice_date", "Invoice date", "date", { highValue: true }),
    f("grant_name", "Grant / project name", "text", { showIf: { key: "funding_source", in: ["Government Grant", "Industry", "CSR", "Other"] } }),
    f("sanction_order_no", "Sanction order number", "text", { highValue: true, showIf: { key: "funding_source", in: ["Government Grant", "Industry", "CSR", "Other"] } }),
    f("sanction_order_date", "Sanction order date", "date", { highValue: true, showIf: { key: "funding_source", in: ["Government Grant", "Industry", "CSR", "Other"] } }),
    f("installation_cost_lakhs", "Installation cost (if separate)", "number", { unit: "₹ lakhs", highValue: true }),
    f("total_investment_lakhs", "Total investment (equipment + installation + other)", "number", { unit: "₹ lakhs", highValue: true }),
  ] },
  { key: "technical", title: "Technical specifications", fields: [
    f("detailed_specifications", "Detailed specifications", "textarea"),
    f("spec_rows", "Specification table", "kv", { help: "Add feature / value rows, like the table in the equipment handbook (for example “Accuracy: up to 0.1 mm”)." }),
    f("operating_range", "Operating range"),
    f("accuracy", "Accuracy / precision"),
    sel("power_phase", "Power: phase", ["Single phase", "Three phase", "DC", "Not applicable"]),
    f("power_voltage", "Power: voltage", "text", { placeholder: "e.g. 230V AC" }),
    f("power_kw", "Power: rating", "text", { placeholder: "e.g. 1.2 kW" }),
    f("dimensions", "Physical dimensions", "text", { unit: "L × W × H cm" }),
    f("weight_kg", "Weight", "number", { unit: "kg" }),
  ] },
  // template-specific section is inserted here (see buildSpec)
  { key: "warranty", title: "Warranty & maintenance", fields: [
    f("warranty_period_years", "Warranty period", "number", { unit: "years" }),
    f("warranty_start", "Warranty start date", "date"),
    f("warranty_end", "Warranty end date", "date"),
    sel("warranty_terms", "Warranty terms", ["Comprehensive", "Parts only"]),
    yn("amc_required", "AMC required?"),
    f("amc_provider", "AMC provider details", "text", { showIf: when("amc_required", "Yes") }),
    f("amc_start", "AMC contract start date", "date", { showIf: when("amc_required", "Yes") }),
    f("amc_end", "AMC contract end date", "date", { showIf: when("amc_required", "Yes") }),
    f("amc_annual_cost", "Annual AMC cost", "number", { unit: "₹", showIf: when("amc_required", "Yes") }),
    f("amc_last_done", "Last AMC done on", "date", { showIf: when("amc_required", "Yes") }),
    f("last_validation_date", "Date of latest validation / calibration", "date"),
    f("next_calibration_due", "Next calibration due date", "date"),
    f("last_service_date", "Last service date", "date"),
    f("next_service_due", "Next service due date", "date"),
  ] },
  { key: "operations", title: "Operational details", fields: [
    f("commissioning_date", "Date of commissioning", "date"),
    yn("training_provided", "Training provided?", { highValue: true }),
    f("training_date", "Training date", "date", { highValue: true, showIf: when("training_provided", "Yes") }),
    f("training_duration", "Training duration", "text", { highValue: true, showIf: when("training_provided", "Yes") }),
    f("faculty_trained", "Number of faculty trained", "number", { highValue: true, showIf: when("training_provided", "Yes") }),
    yn("user_manual", "User manual available?"),
    yn("sop_available", "SOP document available?"),
    f("location_facility", "Location of the facility", "text", { help: "Where in the college, e.g. “Central Instrumentation Laboratory”." }),
    f("building", "Building"),
    f("floor", "Floor"),
    f("room", "Room number"),
    sel("accessibility", "Accessibility", ["24x7", "Restricted hours", "Prior permission"]),
  ] },
  { key: "usage", title: "Usage & performance", fields: [
    sel("current_status", "Current status", ["Working", "Under maintenance", "Down", "Under repair"], {}),
    f("primary_application", "Primary application"),
    f("courses_using", "Courses using this equipment", "textarea"),
    f("research_projects", "Research projects using this equipment", "textarea"),
    f("avg_usage_hours", "Average usage", "number", { unit: "hours / week" }),
    f("utilization_percent", "Utilization rate", "number", { unit: "%" }),
    f("known_issues", "Known issues / problems", "textarea"),
    sel("performance_rating", "Performance rating", ["Excellent", "Good", "Average", "Poor"]),
  ] },
  { key: "documents", title: "Documents & photos (all optional)", files: true, fields: [] },
  { key: "contact", title: "Contact information", fields: [
    f("contact_name", "Primary contact person (lab in-charge)", "text", {}),
    f("contact_designation", "Designation"),
    f("contact_department", "Department"),
    f("contact_email", "Email address", "email", {}),
    f("contact_phone", "Phone number", "tel", {}),
    f("alt_contact_name", "Alternate contact person"),
    f("alt_contact_email", "Alternate contact email", "email"),
    f("alt_contact_phone", "Alternate contact phone", "tel"),
  ] },
];

const FILE_KINDS = [
  { key: "photos", label: "Equipment photos" },
  { key: "brochure", label: "Product brochure" },
  { key: "invoice", label: "Purchase invoice" },
  { key: "installation_report", label: "Installation report" },
  { key: "user_manual", label: "User manual" },
  { key: "calibration", label: "Calibration certificates" },
  { key: "amc_contract", label: "AMC contract copy" },
  { key: "training", label: "Training certificates" },
  { key: "other", label: "Other documents" },
  { key: "spec_file", label: "Specification file / datasheet" },
  { key: "service_doc", label: "Warranty card / AMC document" },
  { key: "sop", label: "Safety instructions / SOP" },
];


// ---------- Current form (used for all new equipment): short steps in plain words, help and an example on every question ----------
// "Type of equipment" list (one simple list for every kind of institution). Add or rename entries here only.
const CATEGORIES = [
  ["cat_computing", "Computing", "Desktops, laptops, servers, GPU systems"],
  ["cat_networking", "Networking", "Routers, switches, access points, cabling kits"],
  ["cat_measuring", "Measuring & test instruments", "Oscilloscope, multimeter, signal generator, power supply"],
  ["cat_electronics", "Electronics & embedded", "Microcontroller boards, sensors, FPGA kits, components"],
  ["cat_electrical", "Electrical machines & power", "Motors, generators, transformers, drives, switchgear"],
  ["cat_mechanical", "Mechanical & workshop (incl. heavy machines)", "Lathe, milling, CNC, shaper, press, welding, 3D printer"],
  ["cat_vehicle", "Vehicle & automotive", "Engines, test rigs, dynamometer, EV kits, BAJA / Formula parts"],
  ["cat_thermal", "Thermal & fluid", "Boilers, pumps, heat exchangers, refrigeration, wind tunnel"],
  ["cat_civil", "Civil & survey", "Total station, theodolite, concrete and soil testing"],
  ["cat_science", "Science (physics, chemistry)", "Spectrometer, balance, microscope, centrifuge"],
  ["cat_bio", "Biology & life science", "Incubator, autoclave, PCR, microscopes"],
  ["cat_pharmacy", "Pharmacy", "Tablet press, dissolution tester, HPLC, UV spectrophotometer"],
  ["cat_dental", "Dental & medical", "Dental chair, X-ray unit, phantom head, autoclave"],
  ["cat_software", "Software & licences", "MATLAB, ANSYS, AutoCAD, operating systems"],
  ["cat_infra", "Furniture & infrastructure", "Benches, projectors, AC, UPS, generators"],
  ["cat_other", "Other", "Anything that does not fit above"],
];
const categoryList = () => CATEGORIES.map(([key, label, hint]) => ({ key, label, hint }));
const isCurrent = (key) => typeof key === "string" && key.startsWith("cat_");
const FUNDING = ["Institute budget", "Government grant", "Industry", "CSR", "Other"];
const eg = (v) => ({ example: v });

const CURRENT_SECTIONS = [
  { key: "basic", title: "Basic information", files: ["photos"],
    help: "A few quick facts about this equipment. Skip anything you do not know. You can come back and add it later.",
    fields: [
      f("name", "Equipment name", "text", { help: "The name of this equipment. If it was typed wrongly, correct it here. Pick the same name other labs use so the college list stays tidy.", ...eg("Desktop Computer") }),
      f("variant", "Configuration", "text", { help: "Optional. Only needed when this lab has the same equipment in different configurations. Add each configuration as its own entry.", ...eg("Intel i5, 8 GB RAM, 512 GB SSD") }),
      f("description", "What is it used for?", "textarea", { help: "One or two lines in your own words.", ...eg("Measures voltage waveforms in electronic circuits") }),
      f("manufacturer", "Brand / make", "text", { help: "The company that made it. It is usually printed on the equipment.", ...eg("Kirloskar, Keysight, Dell") }),
      f("model", "Model number", "text", { help: "Look for “Model” on the label at the back or side.", ...eg("DSOX1102G") }),
      f("quantity", "How many do you have?", "number", { help: "Count all units of this equipment in your lab.", ...eg("10") }),
      f("condition", "Condition today", "counts", { help: "Tell us how many units need repair or are not in use. All the others are counted as working." }),
      f("year_bought", "Year bought", "number", { help: "The year it was purchased or installed. An approximate year is fine.", ...eg("2021") }),
      f("warranty_years", "Warranty period", "number", { unit: "years", help: "If units have different warranties, enter the longest. Leave blank or enter 0 if there is none.", ...eg("3") }),
    ] },
  { key: "purchase", title: "Purchase details", files: ["invoice"],
    help: "Only the college office can see this step. It is never shown to the public. Skip anything you do not have.",
    fields: [
      f("total_cost", "Total cost of all units", "number", { unit: "₹", help: "Enter the amount in rupees, for all units together.", ...eg("450000") }),
      f("vendor_name", "Bought from (vendor / supplier)", "text", { ...eg("ABC Scientific Traders") }),
      f("vendor_contact", "Vendor phone or email", "text", { help: "Optional." }),
      sel("funding_source", "Funding source", FUNDING, { help: "Who paid for it?" }),
      f("grant_name", "Grant or project name", "text", { showIf: { key: "funding_source", in: ["Government Grant", "Government grant", "Industry", "CSR", "Other"] }, help: "The name of the scheme or project that paid for it.", ...eg("AICTE MODROBS") }),
      f("invoice_no", "Invoice number", "text", { help: "Printed at the top of the bill." }),
      f("invoice_date", "Invoice date", "date"),
    ] },
  { key: "technical", title: "Technical details", files: ["spec_file"],
    help: "List the main specifications as feature and value, one pair per row. You can also upload the datasheet.",
    fields: [
      f("spec_rows", "Main specifications", "kv", { help: "Add one row for each important feature. For example, “Bandwidth: 100 MHz”, “Spindle speed: 2000 rpm”, “RAM: 16 GB”." }),
    ] },
  { key: "service", title: "Service & maintenance", files: ["service_doc"],
    help: "Only the college office can see this step. It is never shown to the public.",
    fields: [
      yn("amc_required", "Is it under an AMC (service contract)?", { help: "An AMC means a company services the equipment regularly for a yearly fee." }),
      f("amc_provider", "AMC company", "text", { showIf: when("amc_required", "Yes"), ...eg("Blue Star Service") }),
      f("amc_end", "AMC valid until", "date", { showIf: when("amc_required", "Yes") }),
      f("amc_annual_cost", "Yearly AMC cost", "number", { unit: "₹", showIf: when("amc_required", "Yes") }),
    ] },
  { key: "operation", title: "Operation & safety", files: ["user_manual", "sop"],
    help: "Only the college can see this step. Upload the manual or safety sheet if you have one.",
    fields: [
      f("commissioning_date", "Date put into use", "date", { help: "The day it started being used. An approximate date is fine." }),
      yn("training_provided", "Was training given to staff?"),
      f("faculty_trained", "How many faculty were trained?", "number", { showIf: when("training_provided", "Yes") }),
      yn("user_manual", "Is a user manual available?"),
      yn("sop_available", "Are safety instructions / an SOP available?"),
    ] },
  { key: "usage", title: "How it is used",
    help: "This helps students and visitors understand what the equipment is for.",
    fields: [
      f("courses_using", "Courses or subjects that use it", "textarea", { ...eg("Machine Tools Lab, II Year Mechanical") }),
      f("research_projects", "Research or student projects using it", "textarea", { help: "Optional." }),
      f("avg_usage_hours", "Average use per week", "number", { unit: "hours", help: "A rough number is fine.", ...eg("12") }),
    ] },
  { key: "documents", title: "Other documents", files: ["other"],
    help: "Anything else worth keeping with this record: installation report, calibration certificate, training certificate and so on. Optional, and never shown to the public." , fields: [] },
];

// Department-specific templates (additional fields from the SVES template PDF). Keys are auto-prefixed with the template prefix.
const T = (key, dept, label, prefix, fields) => ({ key, dept, label, prefix, fields });
const TEMPLATES = [
  T("power_systems", "EEE", "Power systems equipment", "ps", [
    f("voltage_rating", "Voltage rating", "text", { placeholder: "230V AC / 415V 3-phase / DC" }), f("frequency_range", "Frequency range", "text", { placeholder: "50 Hz / 60 Hz / Variable" }),
    f("power_capacity", "Power capacity", "text", { placeholder: "kW / kVA / HP" }), f("io_channels", "Input / output channels"), f("measurement_parameters", "Measurement parameters", "text", { placeholder: "Voltage, current, power, THD, power factor" }),
    sel("accuracy_class", "Accuracy class", ["Class 0.1", "Class 0.5", "Class 1.0"]), f("communication_interface", "Communication interface", "text", { placeholder: "RS232 / USB / Ethernet / GPIB" }),
    f("software_included", "Software included (name and version)"), sel("software_license", "Software license", ["Perpetual", "Annual", "Limited users"]),
    f("calibration_valid_until", "Calibration certificate valid until", "date"), sel("calibration_frequency", "Calibration frequency", ["Quarterly", "Half-yearly", "Annual"]),
    f("safety_features", "Safety features"), f("compliance_standards", "Compliance standards", "text", { placeholder: "IEC / IEEE / IS" }),
    sel("spare_parts", "Spare parts availability", ["From manufacturer", "Local vendor"]), f("expected_life_years", "Expected life", "number", { unit: "years" }),
    f("annual_operating_cost", "Annual operating cost (power + maintenance)", "number", { unit: "₹" }), sel("training_required", "Training required", ["Basic", "Advanced", "Certification needed"]),
    f("safety_certification", "Safety certification", "text", { placeholder: "CE / UL / BIS" }),
  ]),
  T("control_systems", "EEE", "Control systems equipment", "cs", [
    sel("controller_type", "Controller type", ["PLC", "Microcontroller", "SCADA"]), f("io_configuration", "I/O configuration", "text", { placeholder: "Digital / analog inputs and outputs" }),
    f("programming_software", "Programming software (name and license)"), sel("communication_protocol", "Communication protocol", ["Modbus", "Profibus", "Ethernet/IP", "Other"]),
    f("scan_time_ms", "Scan time", "number", { unit: "ms" }), f("memory_capacity", "Memory capacity", "text", { placeholder: "KB / MB" }), f("number_of_channels", "Number of channels (input / output)"),
    f("hmi_screen_size", "HMI screen size (if applicable)"), sel("supported_languages", "Supported languages", ["Ladder Logic", "Function Block", "Structured Text", "Multiple"]),
  ]),
  T("comm_signal", "ECE", "Communication & signal processing equipment", "sp", [
    f("frequency_range", "Frequency range", "text", { placeholder: "kHz / MHz / GHz" }), f("bandwidth", "Bandwidth"), f("modulation_types", "Modulation types", "text", { placeholder: "AM / FM / PM / QAM / PSK" }),
    f("number_of_ports", "Number of ports", "text", { placeholder: "2-port / 4-port" }), f("signal_generation", "Signal generation", "text", { placeholder: "Sine / square / triangle / arbitrary" }),
    sel("display_type", "Display type", ["LCD", "TFT", "Touchscreen"]), f("resolution", "Resolution", "text", { placeholder: "Bits / pixels" }), f("sample_rate", "Sample rate", "text", { placeholder: "Samples per second" }),
    f("channel_capacity", "Channel capacity"), f("antenna_type", "Antenna type (if applicable)"), f("network_analyzer_features", "Network analyzer features", "text", { placeholder: "S-parameters measurement" }),
  ]),
  T("embedded_vlsi", "ECE", "Embedded systems & VLSI equipment", "ev", [
    sel("processor_controller", "Processor / controller", ["ARM", "AVR", "PIC", "8051", "FPGA", "Other"]), sel("architecture", "Architecture", ["8-bit", "16-bit", "32-bit", "64-bit"]),
    f("clock_speed", "Clock speed", "text", { placeholder: "MHz / GHz" }), f("ram_rom", "RAM / ROM", "text", { placeholder: "KB / MB" }), f("development_board", "Development board", "text", { placeholder: "Arduino / Raspberry Pi / STM32 / Xilinx" }),
    f("programming_languages", "Programming languages", "text", { placeholder: "C / C++ / Python / VHDL / Verilog" }), f("ide_software", "IDE software (name and version)"),
    sel("debugger_interface", "Debugger interface", ["JTAG", "SWD", "UART", "Other"]), f("expansion_slots", "Expansion slots (number and type)"), f("supported_modules", "Supported modules", "text", { placeholder: "WiFi / Bluetooth / GSM / GPS" }),
    f("fpga_specifications", "FPGA specifications", "text", { placeholder: "Logic elements, I/O pins" }),
  ]),
  T("computing_server", "CSE", "Computing & server equipment", "cp", [
    f("processor", "Processor", "text", { placeholder: "Intel / AMD, model, generation" }), f("number_of_cores", "Number of cores", "text", { placeholder: "Physical + logical" }), f("clock_speed_ghz", "Clock speed", "number", { unit: "GHz" }),
    f("ram", "RAM", "text", { placeholder: "Size (GB) and type (DDR4 / DDR5)" }), f("storage", "Storage", "text", { placeholder: "HDD / SSD capacity and type" }), f("graphics_card", "Graphics card (model, VRAM)"),
    sel("operating_system", "Operating system", ["Windows", "Linux", "macOS", "Multiple"]), sel("network_interface", "Network interface", ["Gigabit", "10G Ethernet", "Other"]),
    f("number_of_systems", "Number of systems (for computer labs)", "number"), f("rack_unit_size", "Rack unit size (for servers)", "number", { unit: "U" }), f("power_supply", "Power supply (wattage, redundancy)"), f("expansion_slots", "Expansion slots (PCIe slots available)"),
  ]),
  T("ai_ml", "CSE", "AI/ML & specialized computing", "ai", [
    f("ai_accelerator", "AI accelerator", "text", { placeholder: "NVIDIA GPU / Google TPU / Intel Movidius" }), f("gpu_model", "GPU model", "text", { placeholder: "RTX 3090 / A100 / V100" }), f("cuda_cores", "CUDA cores", "number"), f("tensor_cores", "Tensor cores", "number"),
    f("gpu_memory", "GPU memory", "text", { placeholder: "GB GDDR6 / HBM2" }), f("software_framework", "Software framework", "text", { placeholder: "TensorFlow / PyTorch / Keras" }), f("preinstalled_libraries", "Pre-installed libraries", "text", { placeholder: "CUDA / cuDNN versions" }),
    sel("deep_learning_capabilities", "Deep learning capabilities", ["Training", "Inference", "Training and inference"]), f("max_power_consumption_w", "Maximum power consumption", "number", { unit: "W" }), sel("cooling_system", "Cooling system", ["Air", "Liquid"]),
  ]),
  T("networking", "CSE", "Networking equipment", "nw", [
    sel("device_type", "Device type", ["Router", "Switch", "Firewall", "Access point", "Other"]), f("port_configuration", "Port configuration", "text", { placeholder: "24-port / 48-port" }), f("port_speed", "Port speed", "text", { placeholder: "1 / 10 / 40 Gbps" }),
    f("poe_support", "PoE support (yes / no, wattage per port)"), sel("management", "Management", ["Managed", "Unmanaged"]), sel("layer_support", "Layer support", ["Layer 2", "Layer 3"]), f("vlan_support", "VLAN support (number of VLANs)"),
    f("throughput", "Throughput", "text", { placeholder: "Gbps / packets per second" }), f("routing_protocols", "Routing protocols", "text", { placeholder: "OSPF / BGP / RIP / EIGRP" }), f("security_features", "Security features", "text", { placeholder: "ACL / NAT / VPN" }),
    f("wireless_standard", "Wireless standard (for WiFi)", "text", { placeholder: "802.11ac / ax / WiFi 6" }),
  ]),
  T("civil_testing", "Civil", "Testing & measurement equipment", "ct", [
    sel("test_type", "Test type", ["Compression", "Tension", "Flexural", "Shear", "Other"]), f("load_capacity", "Load capacity", "text", { placeholder: "kN / tons" }), f("loading_rate", "Loading rate", "text", { placeholder: "mm/min or kN/sec" }),
    f("stroke_length", "Stroke length", "number", { unit: "mm" }), f("accuracy_pct", "Accuracy", "text", { placeholder: "± % of reading" }), sel("display_type", "Display type", ["Digital", "Analog"]),
    f("data_logging", "Data logging (yes / no, storage capacity)"), f("sample_size", "Sample size (maximum dimensions L × W × H)"), f("crosshead_speed_range", "Crosshead speed range", "text", { placeholder: "mm/min" }),
    sel("control_mode", "Control mode", ["Load control", "Displacement control"]), f("safety_features", "Safety features", "text", { placeholder: "Overload protection, emergency stop" }), sel("calibration_standard", "Calibration standard", ["IS", "ASTM", "BS"]),
  ]),
  T("survey_geotech", "Civil", "Survey & geotechnical equipment", "sg", [
    sel("measurement_type", "Measurement type", ["Distance", "Angle", "Elevation", "Coordinates", "Multiple"]), f("accuracy", "Accuracy", "text", { placeholder: "± mm or ± seconds" }), f("range_m", "Range", "number", { unit: "meters" }),
    f("display_resolution_mm", "Display resolution", "number", { unit: "mm" }), f("battery_life_h", "Battery life", "number", { unit: "hours" }), f("measurement_time_s", "Measurement time", "number", { unit: "seconds per reading" }),
    f("data_storage", "Data storage (number of points)"), f("communication", "Communication", "text", { placeholder: "Bluetooth / USB / WiFi" }), f("gps_gnss", "GPS/GNSS (yes / no, channels)"), f("weather_resistance", "Weather resistance (IP rating)"), f("tripod_compatibility", "Tripod compatibility (thread size)"),
  ]),
  T("concrete_material", "Civil", "Concrete & material testing", "cm", [
    sel("test_standard", "Test standard", ["IS", "ASTM", "BS"]), sel("sample_type", "Sample type", ["Cube", "Cylinder", "Beam", "Other"]), f("curing_period_days", "Curing period", "number", { unit: "days" }),
    f("mold_size", "Mold size", "text", { placeholder: "mm (cube / cylinder dimensions)" }), f("penetration_depth", "Penetration depth (for penetrometer)", "number", { unit: "mm" }), f("rebound_number_range", "Rebound number range (rebound hammer)"),
    f("ultrasonic_frequency", "Ultrasonic frequency (UPV)", "number", { unit: "kHz" }), f("moisture_range", "Moisture measurement range (moisture meter)", "text", { placeholder: "%" }), f("temperature_range", "Temperature range", "text", { placeholder: "°C operating range" }),
    sel("calibration_block", "Calibration block", ["Included", "Separate"]),
  ]),
  T("manufacturing", "Mechanical", "Manufacturing & machining equipment", "mf", [
    sel("machine_type", "Machine type", ["CNC", "Manual", "Semi-automatic"]), f("work_envelope", "Work envelope", "text", { placeholder: "X × Y × Z travel (mm)" }), f("spindle_speed", "Spindle speed", "text", { placeholder: "RPM range" }),
    f("spindle_taper", "Spindle taper", "text", { placeholder: "BT40 / BT50 / ISO" }), sel("number_of_axes", "Number of axes", ["3-axis", "4-axis", "5-axis", "Other"]), f("feed_rate", "Feed rate", "text", { placeholder: "mm/min" }),
    f("positioning_accuracy", "Positioning accuracy", "text", { placeholder: "± mm" }), f("repeatability", "Repeatability", "text", { placeholder: "± mm" }), f("tool_capacity", "Tool capacity (tools in magazine)", "number"),
    sel("controller", "Controller", ["Fanuc", "Siemens", "Heidenhain", "Other"]), f("max_workpiece_weight", "Maximum workpiece weight", "number", { unit: "kg" }), f("motor_power_kw", "Motor power", "number", { unit: "kW" }), f("coolant_system", "Coolant system (yes / no, capacity)"),
  ]),
  T("additive_3d", "Mechanical", "3D printing & additive manufacturing", "am", [
    sel("printing_technology", "Printing technology", ["FDM", "SLA", "SLS", "DLP", "DMLS", "Other"]), f("build_volume", "Build volume", "text", { placeholder: "X × Y × Z (mm)" }), f("layer_resolution_microns", "Layer resolution", "number", { unit: "microns" }),
    f("printing_speed", "Printing speed", "text", { placeholder: "mm/sec or mm³/hour" }), f("nozzle_diameter", "Nozzle diameter", "text", { placeholder: "mm" }), f("material_compatibility", "Material compatibility", "text", { placeholder: "PLA / ABS / PETG / resin / metal" }),
    f("heated_bed", "Heated bed (yes / no, max temperature)"), sel("extruder_type", "Extruder type", ["Single", "Dual", "Multi"]), yn("auto_bed_leveling", "Auto bed leveling?"),
    f("connectivity", "Connectivity", "text", { placeholder: "USB / WiFi / Ethernet / SD card" }), f("slicing_software", "Slicing software name"), f("max_print_temperature", "Maximum print temperature", "number", { unit: "°C" }),
  ]),
  T("thermal_fluid", "Mechanical", "Thermal & fluid equipment", "tf", [
    f("temperature_range", "Temperature range", "text", { placeholder: "°C minimum to maximum" }), f("heating_cooling_capacity", "Heating / cooling capacity", "text", { placeholder: "kW / BTU" }), f("flow_rate_range", "Flow rate range", "text", { placeholder: "LPM / m³/hr" }),
    f("pressure_range", "Pressure range", "text", { placeholder: "Bar / PSI" }), f("fluid_type", "Fluid type", "text", { placeholder: "Water / air / oil / refrigerant" }), f("heat_transfer_area", "Heat transfer area", "number", { unit: "m²" }),
    f("efficiency_pct", "Efficiency", "number", { unit: "%" }), sel("pump_type", "Pump type", ["Centrifugal", "Gear", "Reciprocating", "Other"]), sel("compressor_type", "Compressor type", ["Reciprocating", "Screw", "Scroll", "Other"]),
    f("refrigerant_type", "Refrigerant type", "text", { placeholder: "R134a / R410A / R22" }), f("display_sensors", "Display (temperature / pressure sensors)"), sel("control_system", "Control system", ["PID", "Manual"]),
  ]),
  T("metrology", "Mechanical", "Metrology & inspection equipment", "mt", [
    f("measurement_range", "Measurement range", "text", { placeholder: "mm / inches" }), f("resolution", "Resolution", "text", { placeholder: "microns / 0.001 mm" }), f("accuracy_microns", "Accuracy", "text", { placeholder: "± microns" }),
    f("measurement_type", "Measurement type", "text", { placeholder: "Length / diameter / flatness / roundness" }), sel("coordinate_system", "Coordinate system", ["X-Y-Z", "Polar"]), sel("probe_type", "Probe type", ["Touch probe", "Laser", "Vision"]),
    f("measurement_speed", "Measurement speed", "text", { placeholder: "mm/sec" }), f("working_table_size", "Working table size", "text", { placeholder: "mm × mm" }), f("measurement_software", "Measurement software name"),
    f("data_export", "Data export", "text", { placeholder: "Excel / PDF / CAD" }), f("calibration_valid_until", "Calibration certificate valid until", "date"),
  ]),
  T("general", "General", "Other equipment (pharmacy, dental, general labs)", "gn", []),
];

const templateList = () => [...TEMPLATES.map(({ key, dept, label }) => ({ key, dept, label })), ...CATEGORIES.map(([key, label]) => ({ key, dept: "Type", label }))];
const findTemplate = (key) => TEMPLATES.find((t) => t.key === key) || (CATEGORIES.find((c) => c[0] === key) && { key, dept: "Type", label: CATEGORIES.find((c) => c[0] === key)[1], prefix: "", fields: [] });

// Full ordered form for one template: base sections with the template's extra section after "technical".
function buildSpec(templateKey) {
  const tpl = findTemplate(templateKey);
  if (isCurrent(templateKey)) return { template: tpl ? { key: tpl.key, label: tpl.label, dept: tpl.dept } : null, sections: CURRENT_SECTIONS, fileKinds: FILE_KINDS, highValueLakhs: null, current: true };
  const sections = [];
  for (const s of BASE_SECTIONS) {
    sections.push(s);
    if (s.key === "technical" && tpl && tpl.fields.length) {
      sections.push({ key: "template", title: `${tpl.label}: additional details`, fields: tpl.fields.map((x) => ({ ...x, key: `${tpl.prefix}_${x.key}` })) });
    }
  }
  return { template: tpl ? { key: tpl.key, label: tpl.label, dept: tpl.dept } : null, sections, fileKinds: FILE_KINDS, highValueLakhs: HIGH_VALUE_LAKHS };
}

const empty = (v) => v === undefined || v === null || (typeof v === "string" && !v.trim()) || (Array.isArray(v) && v.length === 0);
function isVisible(field, data) {
  const cost = Number(data.equipment_cost_lakhs);
  if (field.highValue && !(cost > HIGH_VALUE_LAKHS)) return false;
  const c = field.showIf;
  if (!c) return true;
  const v = data[c.key];
  if (c.equals !== undefined) return v === c.equals;
  if (c.in) return c.in.includes(v);
  return !empty(v);
}
function missingRequired(spec, data) {
  const out = [];
  if (empty(data.name)) out.push({ key: "name", label: "Equipment name" });
  for (const s of spec.sections) for (const fld of s.fields) if (fld.required && isVisible(fld, data) && empty(data[fld.key])) out.push({ key: fld.key, label: fld.label });
  return out;
}
const allowedKeys = (spec) => new Set(["name", ...spec.sections.flatMap((s) => s.fields.map((x) => x.key))]);

module.exports = { buildSpec, templateList, categoryList, isCurrent, findTemplate, isVisible, missingRequired, allowedKeys, FILE_KINDS, HIGH_VALUE_LAKHS };

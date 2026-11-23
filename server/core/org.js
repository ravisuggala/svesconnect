// Organisation constants shared by migration and routes.
const COLLEGES = [
  { code: "CENTRAL", name: "SVES Central Administration", city: "Bhimavaram", central: 1 },
  { code: "VWU", principal: "principal@svecw.edu.in", name: "Vishnu Women's University", city: "Bhimavaram", address: "Vishnupur, Kovvada Village, Bhimavaram, West Godavari District, Andhra Pradesh – 534202" },
  { code: "VIT", principal: "principal@vishnu.edu.in", name: "Vishnu Institute of Technology", city: "Bhimavaram", address: "Vishnupur, Kovvada Village, Bhimavaram, West Godavari District, Andhra Pradesh – 534202" },
  { code: "SVCP", principal: "principal@svcp.edu.in", name: "Shri Vishnu College of Pharmacy", city: "Bhimavaram", address: "Vishnupur, Kovvada Village, Bhimavaram, West Godavari District, Andhra Pradesh – 534202" },
  { code: "VDC", principal: "principal@vdc.edu.in", name: "Vishnu Dental College", city: "Bhimavaram", address: "Vishnupur, Kovvada Village, Bhimavaram, West Godavari District, Andhra Pradesh – 534202" },
  { code: "BVRC", principal: "principal@bvricedegree.edu.in", name: "B. V. Raju College", city: "Bhimavaram", address: "Vishnupur, Kovvada Village, Bhimavaram, West Godavari District, Andhra Pradesh – 534202" },
  { code: "SBSP", principal: "principal@sbspolytechnic.edu.in", name: "Smt. B. Seetha Polytechnic", city: "Bhimavaram", address: "Vishnupur, Kovvada Village, Bhimavaram, West Godavari District, Andhra Pradesh – 534202" },
  { code: "BVRIT", principal: "principal@bvrit.ac.in", name: "B. V. Raju Institute of Technology", city: "Narsapur", address: "Vishnupur, Narsapur, Medak District, Telangana – 502313" },
  { code: "VIPER", principal: "principal@viper.ac.in", name: "Vishnu Institute of Pharmaceutical Education and Research", city: "Narsapur", address: "Vishnupur, Narsapur, Medak District, Telangana – 502313" },
  { code: "BVRITH", principal: "principal@bvrithyderabad.edu.in", name: "BVRIT Hyderabad College of Engineering for Women", city: "Hyderabad", address: "Plot No. 8-5/4, Rajiv Gandhi Nagar Colony, Nizampet Road, Bachupally, Hyderabad, Telangana – 500090" },
  { code: "VSCH", principal: "principal@vishnuschool.edu.in", name: "Vishnu School", city: "Bhimavaram" },
];

// Each college gets its own administrator login (role college_admin): admin@<same domain as the principal; VWU uses vwu.edu.in>.
const collegeAdminEmail = (c) => `admin@${c.code === "VWU" ? "vwu.edu.in" : String(c.principal || "").split("@")[1]}`;

// Hierarchy: admin creates/resets principals, principals create HODs, HODs create lab coordinators (role lab_incharge).
const CHILD_ROLE = { admin: "principal", principal: "hod", hod: "lab_incharge" };

// Initial password for every account created by the hierarchy; users may change it any time (it is not forced).
const defaultPassword = () => process.env.DEFAULT_PASSWORD || "svesconnect@123";

module.exports = { COLLEGES, CHILD_ROLE, defaultPassword, collegeAdminEmail };

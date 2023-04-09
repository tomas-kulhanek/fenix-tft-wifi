export default interface ThermostatResponse {

  A1: { timestamp: number; wattType: string; value: string };
  // eslint-disable-next-line max-len
  At: { timestamp: number; aggregators: string[]; wattsType: string; unit: string; value: number; divFactor: number; min: number; max: number };
  Bt: { timestamp: number; wattType: string; value: string; min: number };
  Cg: { timestamp: number; wattType: string; value: number[] };
  Cm: { timestamp: number; wattType: string; value: string; min: number };
  Co: { timestamp: number; wattType: string; value: string };
  Dd: { timestamp: number; wattType: string; value: string };
  Dm: { timestamp: number; wattType: string; value: number; min: number; max: number };
  Er: { timestamp: number; wattType: string; value: number[] };
  Gp: { timestamp: number; wattType: string; value: string };
  "H1": { timestamp: number; wattType: string; value: string };
  "H2": { timestamp: number; wattType: string; value: string };
  "H3": { timestamp: number; wattType: string; value: number[] };
  "H4": { timestamp: number; wattType: string; value: number };
  "Hs": { timestamp: number; wattType: string; value: number };
  Id: { timestamp: number; wattType: string; value: string };
  Ma: { timestamp: number; wattType: string; value: number; unit: string; divFactor: number; min: number; max: number; increment: 5 };
  Pf: { timestamp: number; wattType: string; value: number[] };
  Rn: { timestamp: number; wattType: string; value: string }; //Thermostat name
  "S1": { timestamp: number; wattType: string; value: string }; // ID
  "S2": { timestamp: number; wattType: string; value: string };
  "S3": { timestamp: number; wattType: string; value: number };
  Sp: { timestamp: number; wattType: string; value: string; unit: string; divFactor: number; min: number; max: number };
  St: { timestamp: number; wattType: string; value: number };
  Sv: { timestamp: number; wattType: string; value: string }; // Software version
  Ty: { timestamp: number; wattType: string; value: string }; //Type 
  Tz: { timestamp: number; wattType: string; value: string }; //Time zone
  Un: { timestamp: number; wattType: string; value: number };
  Vs: { timestamp: number; wattType: string; value: string };
  bo: { timestamp: number; wattType: string; value: number; unit: string; divFactor: number; min: number; max: number };
  df: { timestamp: number; wattType: string; value: number; unit: string; divFactor: number; min: number; max: number };
  fc: { timestamp: number; wattType: string; value: number };
}
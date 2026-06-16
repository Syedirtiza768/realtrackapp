/**
 * Standard Parts Categories
 *
 * Brand-agnostic 18-category structure for automotive parts classification.
 * Used by VIN parts compatibility generation and listing enrichment.
 */

export interface PartsSubcategory {
  id: string;
  label: string;
  /** Whether this subcategory requires exact fitment verification */
  requiresExactFitment: boolean;
  /** Whether parts in this subcategory are commonly shared across platforms */
  platformShareable: boolean;
  /** Whether this is a high-demand eBay Motors category */
  highDemand: boolean;
}

export interface PartsCategory {
  id: string;
  label: string;
  subcategories: PartsSubcategory[];
}

export const PARTS_CATEGORIES: PartsCategory[] = [
  {
    id: 'engine_components',
    label: 'Engine Components',
    subcategories: [
      { id: 'oil_filter', label: 'Oil Filter', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'spark_plugs', label: 'Spark Plugs', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'air_filter', label: 'Air Filter', requiresExactFitment: false, platformShareable: false, highDemand: true },
      { id: 'belts', label: 'Belts & Tensioners', requiresExactFitment: false, platformShareable: true, highDemand: false },
      { id: 'gaskets', label: 'Gaskets & Seals', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'timing', label: 'Timing Chain/Belt Kit', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'pistons', label: 'Pistons & Rings', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'valves', label: 'Valves & Springs', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'complete_engine', label: 'Complete Engine', requiresExactFitment: true, platformShareable: true, highDemand: true },
    ],
  },
  {
    id: 'transmission_components',
    label: 'Transmission Components',
    subcategories: [
      { id: 'fluid', label: 'Transmission Fluid', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'filter', label: 'Transmission Filter', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'pan_gasket', label: 'Pan Gasket', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'solenoids', label: 'Solenoids & Sensors', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'torque_converter', label: 'Torque Converter', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'complete_transmission', label: 'Complete Transmission', requiresExactFitment: true, platformShareable: true, highDemand: true },
    ],
  },
  {
    id: 'suspension_parts',
    label: 'Suspension Parts',
    subcategories: [
      { id: 'struts', label: 'Strut Assemblies', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'shocks', label: 'Shock Absorbers', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'control_arms', label: 'Control Arms', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'sway_bar_links', label: 'Sway Bar Links', requiresExactFitment: false, platformShareable: true, highDemand: false },
      { id: 'ball_joints', label: 'Ball Joints', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'bushings', label: 'Bushings', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'coil_springs', label: 'Coil Springs', requiresExactFitment: true, platformShareable: true, highDemand: false },
    ],
  },
  {
    id: 'brake_system',
    label: 'Brake System',
    subcategories: [
      { id: 'pads', label: 'Brake Pads', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'rotors', label: 'Brake Rotors', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'calipers', label: 'Brake Calipers', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'brake_lines', label: 'Brake Lines & Hoses', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'master_cylinder', label: 'Master Cylinder', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'abs_module', label: 'ABS Module', requiresExactFitment: true, platformShareable: true, highDemand: true },
    ],
  },
  {
    id: 'steering_parts',
    label: 'Steering Parts',
    subcategories: [
      { id: 'tie_rods', label: 'Tie Rod Ends', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'steering_rack', label: 'Steering Rack', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'power_steering_pump', label: 'Power Steering Pump', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'steering_column', label: 'Steering Column', requiresExactFitment: true, platformShareable: false, highDemand: false },
    ],
  },
  {
    id: 'electrical_components',
    label: 'Electrical Components',
    subcategories: [
      { id: 'alternator', label: 'Alternator', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'starter', label: 'Starter Motor', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'battery', label: 'Battery', requiresExactFitment: false, platformShareable: false, highDemand: true },
      { id: 'wiring_harness', label: 'Wiring Harness', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'fuse_box', label: 'Fuse Box / Junction Block', requiresExactFitment: true, platformShareable: false, highDemand: false },
    ],
  },
  {
    id: 'cooling_system',
    label: 'Cooling System',
    subcategories: [
      { id: 'radiator', label: 'Radiator', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'thermostat', label: 'Thermostat', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'water_pump', label: 'Water Pump', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'coolant_hoses', label: 'Coolant Hoses', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'fan_assembly', label: 'Fan Assembly', requiresExactFitment: true, platformShareable: true, highDemand: true },
    ],
  },
  {
    id: 'fuel_system',
    label: 'Fuel System',
    subcategories: [
      { id: 'fuel_pump', label: 'Fuel Pump', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'fuel_injectors', label: 'Fuel Injectors', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'fuel_filter', label: 'Fuel Filter', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'fuel_rail', label: 'Fuel Rail', requiresExactFitment: true, platformShareable: true, highDemand: false },
    ],
  },
  {
    id: 'exhaust_system',
    label: 'Exhaust System',
    subcategories: [
      { id: 'catalytic_converter', label: 'Catalytic Converter', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'muffler', label: 'Muffler', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'exhaust_manifold', label: 'Exhaust Manifold', requiresExactFitment: true, platformShareable: true, highDemand: false },
      { id: 'o2_sensors', label: 'O2 Sensors', requiresExactFitment: false, platformShareable: true, highDemand: true },
    ],
  },
  {
    id: 'hvac_parts',
    label: 'HVAC Parts',
    subcategories: [
      { id: 'ac_compressor', label: 'A/C Compressor', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'condenser', label: 'A/C Condenser', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'evaporator', label: 'Evaporator', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'heater_core', label: 'Heater Core', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'blower_motor', label: 'Blower Motor', requiresExactFitment: true, platformShareable: false, highDemand: true },
    ],
  },
  {
    id: 'body_panels',
    label: 'Body Panels',
    subcategories: [
      { id: 'hood', label: 'Hood', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'fenders', label: 'Fenders', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'doors', label: 'Doors', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'trunk_lid', label: 'Trunk/Hatch', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'quarter_panels', label: 'Quarter Panels', requiresExactFitment: true, platformShareable: false, highDemand: false },
    ],
  },
  {
    id: 'bumpers',
    label: 'Bumpers',
    subcategories: [
      { id: 'front_bumper_cover', label: 'Front Bumper Cover', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'rear_bumper_cover', label: 'Rear Bumper Cover', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'bumper_reinforcement', label: 'Bumper Reinforcement', requiresExactFitment: true, platformShareable: false, highDemand: false },
    ],
  },
  {
    id: 'interior_parts',
    label: 'Interior Parts',
    subcategories: [
      { id: 'seats', label: 'Seats & Components', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'dashboard', label: 'Dashboard Components', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'center_console', label: 'Center Console', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'door_panels', label: 'Door Panels', requiresExactFitment: true, platformShareable: false, highDemand: true },
    ],
  },
  {
    id: 'exterior_trim',
    label: 'Exterior Trim',
    subcategories: [
      { id: 'emblems', label: 'Emblems & Badges', requiresExactFitment: false, platformShareable: false, highDemand: true },
      { id: 'door_handles', label: 'Door Handles', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'mirror_covers', label: 'Mirror Covers', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'molding', label: 'Molding & Trim', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'grille', label: 'Grille', requiresExactFitment: true, platformShareable: false, highDemand: true },
    ],
  },
  {
    id: 'lighting',
    label: 'Lighting',
    subcategories: [
      { id: 'headlights', label: 'Headlight Assemblies', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'tail_lights', label: 'Tail Light Assemblies', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'fog_lights', label: 'Fog Lights', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'turn_signals', label: 'Turn Signals', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'bulbs', label: 'Bulbs & LED Modules', requiresExactFitment: false, platformShareable: true, highDemand: true },
    ],
  },
  {
    id: 'wheels_tires',
    label: 'Wheels & Tires',
    subcategories: [
      { id: 'wheels', label: 'Wheels/Rims', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'tpms_sensors', label: 'TPMS Sensors', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'lug_nuts', label: 'Lug Nuts & Hardware', requiresExactFitment: false, platformShareable: true, highDemand: false },
      { id: 'wheel_bearings', label: 'Wheel Bearings', requiresExactFitment: true, platformShareable: true, highDemand: true },
    ],
  },
  {
    id: 'sensors_modules',
    label: 'Sensors & Modules',
    subcategories: [
      { id: 'abs_sensors', label: 'ABS Wheel Speed Sensors', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'o2_sensors', label: 'O2/Oxygen Sensors', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'ecu', label: 'ECU/PCM', requiresExactFitment: true, platformShareable: true, highDemand: true },
      { id: 'bcm', label: 'Body Control Module', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'radar_sensor', label: 'Radar/Camera Sensors', requiresExactFitment: true, platformShareable: false, highDemand: true },
    ],
  },
  {
    id: 'safety_components',
    label: 'Safety Components',
    subcategories: [
      { id: 'airbags', label: 'Airbags', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'seatbelts', label: 'Seat Belts', requiresExactFitment: true, platformShareable: false, highDemand: true },
      { id: 'pretensioners', label: 'Pretensioners', requiresExactFitment: true, platformShareable: false, highDemand: false },
      { id: 'parking_brake_actuator', label: 'Parking Brake Actuator', requiresExactFitment: true, platformShareable: true, highDemand: false },
    ],
  },
  {
    id: 'maintenance_parts',
    label: 'Maintenance/Service Parts',
    subcategories: [
      { id: 'fluids', label: 'Fluids & Chemicals', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'filters', label: 'All Filters', requiresExactFitment: false, platformShareable: true, highDemand: true },
      { id: 'wiper_blades', label: 'Wiper Blades', requiresExactFitment: false, platformShareable: false, highDemand: true },
      { id: 'bulbs', label: 'Light Bulbs', requiresExactFitment: false, platformShareable: true, highDemand: true },
    ],
  },
];

/**
 * Get categories where platform sharing is safe.
 * These categories have platformShareable=true on all subcategories.
 */
export function getPlatformShareableCategories(): string[] {
  return PARTS_CATEGORIES
    .filter(cat => cat.subcategories.every(sub => sub.platformShareable))
    .map(cat => cat.id);
}

/**
 * Get categories that require exact fitment verification.
 * These should NEVER be listed with inferred compatibility.
 */
export function getExactFitmentRequiredCategories(): string[] {
  return PARTS_CATEGORIES
    .filter(cat => cat.subcategories.some(sub => sub.requiresExactFitment))
    .map(cat => cat.id);
}

/**
 * Get high-demand categories for eBay Motors.
 */
export function getHighDemandCategories(): string[] {
  return PARTS_CATEGORIES
    .filter(cat => cat.subcategories.some(sub => sub.highDemand))
    .map(cat => cat.id);
}

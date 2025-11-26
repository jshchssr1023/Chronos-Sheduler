import { Knex } from 'knex';

/**
 * Phase 1 Migration: Enhanced Car and Shop Fields for Demand Planning
 */

export async function up(knex: Knex): Promise<void> {
  // ============================================
  // ENHANCE CARS TABLE
  // ============================================
  
  const carsColumns = await knex('information_schema.columns')
    .where('table_name', 'cars')
    .where('table_schema', 'public')
    .select('column_name');
  
  const existingCarCols = new Set(carsColumns.map((c: any) => c.column_name));

  await knex.schema.alterTable('cars', (table) => {
    if (!existingCarCols.has('demand_type')) {
      table.string('demand_type', 50).defaultTo('Maintenance Cycle');
    }
    if (!existingCarCols.has('commodity')) {
      table.string('commodity', 100);
    }
    if (!existingCarCols.has('car_type')) {
      table.string('car_type', 100);
    }
    if (!existingCarCols.has('level2_car_type')) {
      table.string('level2_car_type', 100);
    }
    if (!existingCarCols.has('lease_expiry_date')) {
      table.date('lease_expiry_date');
    }
    if (!existingCarCols.has('regulatory_cycle_years')) {
      table.integer('regulatory_cycle_years');
    }
    if (!existingCarCols.has('estimated_duration_days')) {
      table.integer('estimated_duration_days').defaultTo(14);
    }
    if (!existingCarCols.has('target_cost_per_car')) {
      table.decimal('target_cost_per_car', 12, 2);
    }
    if (!existingCarCols.has('owner')) {
      table.string('owner', 255);
    }
    if (!existingCarCols.has('fleet_id')) {
      table.string('fleet_id', 100);
    }
    if (!existingCarCols.has('last_shop_date')) {
      table.date('last_shop_date');
    }
    if (!existingCarCols.has('work_scope')) {
      table.text('work_scope');
    }
  });

  // Add indexes
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_cars_demand_type ON cars(company_id, demand_type)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_cars_commodity ON cars(company_id, commodity)`);

  // ============================================
  // ENHANCE SHOPS TABLE
  // ============================================
  
  const shopsColumns = await knex('information_schema.columns')
    .where('table_name', 'shops')
    .where('table_schema', 'public')
    .select('column_name');
  
  const existingShopCols = new Set(shopsColumns.map((c: any) => c.column_name));

  await knex.schema.alterTable('shops', (table) => {
    if (!existingShopCols.has('shop_type')) {
      table.string('shop_type', 50).defaultTo('Contracted');
    }
    if (!existingShopCols.has('capabilities')) {
      table.jsonb('capabilities').defaultTo(JSON.stringify({
        welding: false,
        painting: false,
        wheel_work: false,
        tank_interior: false,
        structural_repair: false,
        regulatory_inspection: false,
        lining: false,
        valve_repair: false,
        cleaning: false,
        stenciling: false
      }));
    }
    if (!existingShopCols.has('cost_index')) {
      table.decimal('cost_index', 4, 2).defaultTo(1.00);
    }
    if (!existingShopCols.has('weekly_capacity')) {
      table.decimal('weekly_capacity', 10, 2);
    }
    if (!existingShopCols.has('monthly_capacity')) {
      table.decimal('monthly_capacity', 10, 2);
    }
    if (!existingShopCols.has('annual_target')) {
      table.integer('annual_target');
    }
    if (!existingShopCols.has('booking_lead_time_days')) {
      table.integer('booking_lead_time_days').defaultTo(14);
    }
    if (!existingShopCols.has('contact_name')) {
      table.string('contact_name', 255);
    }
    if (!existingShopCols.has('contact_email')) {
      table.string('contact_email', 255);
    }
    if (!existingShopCols.has('contact_phone')) {
      table.string('contact_phone', 50);
    }
    if (!existingShopCols.has('quality_rating')) {
      table.decimal('quality_rating', 2, 1);
    }
    if (!existingShopCols.has('avg_turnaround_days')) {
      table.integer('avg_turnaround_days');
    }
    if (!existingShopCols.has('preferred_commodities')) {
      table.jsonb('preferred_commodities').defaultTo('[]');
    }
    if (!existingShopCols.has('region')) {
      table.string('region', 100);
    }
    if (!existingShopCols.has('railroad_access')) {
      table.jsonb('railroad_access').defaultTo('[]');
    }
  });

  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_shops_shop_type ON shops(company_id, shop_type)`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS idx_shops_region ON shops(company_id, region) WHERE region IS NOT NULL`);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('cars', (table) => {
    table.dropColumn('demand_type');
    table.dropColumn('commodity');
    table.dropColumn('lease_expiry_date');
    table.dropColumn('regulatory_cycle_years');
    table.dropColumn('estimated_duration_days');
    table.dropColumn('target_cost_per_car');
    table.dropColumn('owner');
    table.dropColumn('fleet_id');
    table.dropColumn('last_shop_date');
    table.dropColumn('work_scope');
  });

  await knex.schema.alterTable('shops', (table) => {
    table.dropColumn('shop_type');
    table.dropColumn('capabilities');
    table.dropColumn('cost_index');
    table.dropColumn('booking_lead_time_days');
    table.dropColumn('contact_name');
    table.dropColumn('contact_email');
    table.dropColumn('contact_phone');
    table.dropColumn('quality_rating');
    table.dropColumn('avg_turnaround_days');
    table.dropColumn('preferred_commodities');
    table.dropColumn('region');
    table.dropColumn('railroad_access');
  });

  await knex.raw('DROP INDEX IF EXISTS idx_cars_demand_type');
  await knex.raw('DROP INDEX IF EXISTS idx_cars_commodity');
  await knex.raw('DROP INDEX IF EXISTS idx_shops_shop_type');
  await knex.raw('DROP INDEX IF EXISTS idx_shops_region');
}

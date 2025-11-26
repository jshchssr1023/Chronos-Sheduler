import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clear existing data
  await prisma.assignment.deleteMany({});
  await prisma.car.deleteMany({});
  await prisma.shop.deleteMany({});
  await prisma.scenario.deleteMany({});

  // Create Shops
  const shops = await Promise.all([
    prisma.shop.create({
      data: {
        name: 'Detroit Auto Center',
        city: 'Detroit',
        code: 'DET-001',
        capacity: 50
      }
    }),
    prisma.shop.create({
      data: {
        name: 'Los Angeles Service Hub',
        city: 'Los Angeles',
        code: 'LA-001',
        capacity: 40
      }
    }),
    prisma.shop.create({
      data: {
        name: 'Chicago Fleet Services',
        city: 'Chicago',
        code: 'CHI-001',
        capacity: 35
      }
    }),
    prisma.shop.create({
      data: {
        name: 'Houston Auto Depot',
        city: 'Houston',
        code: 'HOU-001',
        capacity: 30
      }
    }),
    prisma.shop.create({
      data: {
        name: 'Phoenix Service Center',
        city: 'Phoenix',
        code: 'PHX-001',
        capacity: 25
      }
    })
  ]);

  console.log(`✅ Created ${shops.length} shops`);

  // Create Cars
  const priorities = ['Critical', 'High', 'Medium', 'Low'];
  const customers = ['Enterprise Fleet', 'Hertz Corporation', 'Avis Budget', 'National Car Rental', 'Budget Rent a Car'];
  const types = ['Sedan', 'SUV', 'Truck', 'Van'];
  const level2Types = ['Economy', 'Standard', 'Luxury', 'Commercial'];
  const statuses = ['unscheduled', 'scheduled', 'in_progress', 'completed'];

  const cars = [];
  
  for (let i = 1; i <= 100; i++) {
    const qualDate = new Date();
    qualDate.setDate(qualDate.getDate() + Math.floor(Math.random() * 180)); // Random date within next 6 months

    cars.push(
      prisma.car.create({
        data: {
          mark: `CAR-${String(i).padStart(4, '0')}`,
          customer: customers[Math.floor(Math.random() * customers.length)],
          leaseNumber: `LSE-${10000 + i}`,
          type: types[Math.floor(Math.random() * types.length)],
          level2Type: level2Types[Math.floor(Math.random() * level2Types.length)],
          qualDue: qualDate,
          priority: priorities[Math.floor(Math.random() * priorities.length)],
          status: i <= 60 ? 'unscheduled' : 'scheduled', // 60% unscheduled
          reason: i % 5 === 0 ? 'Lease renewal pending' : null
        }
      })
    );
  }

  const createdCars = await Promise.all(cars);
  console.log(`✅ Created ${createdCars.length} cars`);

  // Create Assignments for scheduled cars
  const scheduledCars = createdCars.filter(car => car.status === 'scheduled');
  const assignments = [];

  for (const car of scheduledCars) {
    const shop = shops[Math.floor(Math.random() * shops.length)];
    const monthOffset = Math.floor(Math.random() * 6); // 0-5 months from now
    const assignmentMonth = new Date();
    assignmentMonth.setMonth(assignmentMonth.getMonth() + monthOffset);
    assignmentMonth.setDate(1); // First of the month

    assignments.push(
      prisma.assignment.create({
        data: {
          carId: car.id,
          shopId: shop.id,
          month: assignmentMonth
        }
      })
    );
  }

  await Promise.all(assignments);
  console.log(`✅ Created ${assignments.length} assignments`);

  // Create Sample Scenarios
  const scenario1Assignments = createdCars
    .filter(car => car.priority === 'Critical' && car.status === 'unscheduled')
    .slice(0, 10)
    .map(car => ({
      carId: car.id,
      shopId: shops[0].id,
      month: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString()
    }));

  await prisma.scenario.create({
    data: {
      name: 'Q1 Critical Priority Plan',
      data: {
        description: 'Plan to schedule all critical priority cars in Q1',
        assignments: scenario1Assignments
      }
    }
  });

  const scenario2Assignments = createdCars
    .filter(car => car.customer === 'Enterprise Fleet' && car.status === 'unscheduled')
    .slice(0, 15)
    .map((car, index) => ({
      carId: car.id,
      shopId: shops[index % shops.length].id,
      month: new Date(new Date().setMonth(new Date().getMonth() + 2)).toISOString()
    }));

  await prisma.scenario.create({
    data: {
      name: 'Enterprise Fleet Q2 Schedule',
      data: {
        description: 'Distribute Enterprise Fleet vehicles across all shops',
        assignments: scenario2Assignments
      }
    }
  });

  console.log(`✅ Created 2 sample scenarios`);

  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { PrismaClient, PlanTier, Role, ServerStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@example.com';
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'ChangeMeNow123!';

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN, passwordHash },
    create: {
      email: adminEmail,
      name: 'Administrator',
      role: Role.ADMIN,
      passwordHash,
      emailVerified: new Date(),
    },
  });

  const plans = [
    {
      tier: PlanTier.FREE,
      name: 'Free',
      description: 'Try the service with one device on a shared server.',
      priceMonthly: 0,
      stripePriceId: null,
      maxDevices: 1,
      maxServers: 1,
      bandwidthGB: 10,
      features: ['1 device', '1 server', '10 GB / month', 'Standard speed'],
    },
    {
      tier: PlanTier.BASIC,
      name: 'Basic',
      description: 'Great for everyday browsing across a couple of devices.',
      priceMonthly: 499,
      stripePriceId: process.env.STRIPE_PRICE_BASIC ?? null,
      maxDevices: 3,
      maxServers: 5,
      bandwidthGB: 100,
      features: ['3 devices', '5 servers', '100 GB / month', 'No logs'],
    },
    {
      tier: PlanTier.PRO,
      name: 'Pro',
      description: 'For power users who want speed and global coverage.',
      priceMonthly: 999,
      stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
      maxDevices: 10,
      maxServers: 50,
      bandwidthGB: 1000,
      features: ['10 devices', 'All locations', '1 TB / month', 'Priority routing'],
    },
    {
      tier: PlanTier.ENTERPRISE,
      name: 'Enterprise',
      description: 'Custom deployments, dedicated IPs, and SLA support.',
      priceMonthly: 4999,
      stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
      maxDevices: 100,
      maxServers: 200,
      bandwidthGB: 10000,
      features: ['Unlimited devices', 'Dedicated IPs', '10 TB / month', '24/7 SLA'],
    },
  ] as const;

  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { tier: plan.tier },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        stripePriceId: plan.stripePriceId,
        maxDevices: plan.maxDevices,
        maxServers: plan.maxServers,
        bandwidthGB: plan.bandwidthGB,
        features: [...plan.features],
      },
      create: {
        tier: plan.tier,
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.priceMonthly,
        stripePriceId: plan.stripePriceId,
        maxDevices: plan.maxDevices,
        maxServers: plan.maxServers,
        bandwidthGB: plan.bandwidthGB,
        features: [...plan.features],
      },
    });
  }

  const servers = [
    {
      name: 'US East 1',
      location: 'New York, NY',
      country: 'US',
      hostname: 'us-east-1.vpn.example.com',
      endpoint: 'us-east-1.vpn.example.com:51820',
      publicKey: 'PLACEHOLDER_US_EAST_PUBLIC_KEY_REPLACE_ME=',
      subnetCidr: '10.10.0.0/24',
      premiumOnly: false,
    },
    {
      name: 'EU West 1',
      location: 'Amsterdam, NL',
      country: 'NL',
      hostname: 'eu-west-1.vpn.example.com',
      endpoint: 'eu-west-1.vpn.example.com:51820',
      publicKey: 'PLACEHOLDER_EU_WEST_PUBLIC_KEY_REPLACE_ME=',
      subnetCidr: '10.20.0.0/24',
      premiumOnly: false,
    },
    {
      name: 'AP South 1',
      location: 'Singapore, SG',
      country: 'SG',
      hostname: 'ap-south-1.vpn.example.com',
      endpoint: 'ap-south-1.vpn.example.com:51820',
      publicKey: 'PLACEHOLDER_AP_SOUTH_PUBLIC_KEY_REPLACE_ME=',
      subnetCidr: '10.30.0.0/24',
      premiumOnly: true,
    },
  ];

  for (const server of servers) {
    await prisma.server.upsert({
      where: { hostname: server.hostname },
      update: server,
      create: { ...server, status: ServerStatus.ONLINE },
    });
  }

  console.log('Seed complete. Admin login:', adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

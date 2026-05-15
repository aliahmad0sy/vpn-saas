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
      priceYearly: 0,
      stripePriceId: null,
      stripePriceIdYearly: null,
      trialDays: 0,
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
      priceYearly: 4990,
      stripePriceId: process.env.STRIPE_PRICE_BASIC ?? null,
      stripePriceIdYearly: process.env.STRIPE_PRICE_BASIC_YEARLY ?? null,
      trialDays: 7,
      maxDevices: 3,
      maxServers: 5,
      bandwidthGB: 100,
      features: ['3 devices', '5 servers', '100 GB / month', 'No logs', '7-day free trial'],
    },
    {
      tier: PlanTier.PRO,
      name: 'Pro',
      description: 'For power users who want speed and global coverage.',
      priceMonthly: 999,
      priceYearly: 9990,
      stripePriceId: process.env.STRIPE_PRICE_PRO ?? null,
      stripePriceIdYearly: process.env.STRIPE_PRICE_PRO_YEARLY ?? null,
      trialDays: 14,
      maxDevices: 10,
      maxServers: 50,
      bandwidthGB: 1000,
      features: ['10 devices', 'All locations', '1 TB / month', 'Priority routing', '14-day free trial'],
    },
    {
      tier: PlanTier.ENTERPRISE,
      name: 'Enterprise',
      description: 'Custom deployments, dedicated IPs, and SLA support.',
      priceMonthly: 4999,
      priceYearly: 49990,
      stripePriceId: process.env.STRIPE_PRICE_ENTERPRISE ?? null,
      stripePriceIdYearly: process.env.STRIPE_PRICE_ENTERPRISE_YEARLY ?? null,
      trialDays: 0,
      maxDevices: 100,
      maxServers: 200,
      bandwidthGB: 10000,
      features: ['Unlimited devices', 'Dedicated IPs', '10 TB / month', '24/7 SLA'],
    },
  ] as const;

  for (const plan of plans) {
    const data = {
      name: plan.name,
      description: plan.description,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      stripePriceId: plan.stripePriceId,
      stripePriceIdYearly: plan.stripePriceIdYearly,
      trialDays: plan.trialDays,
      maxDevices: plan.maxDevices,
      maxServers: plan.maxServers,
      bandwidthGB: plan.bandwidthGB,
      features: [...plan.features],
    };
    await prisma.plan.upsert({
      where: { tier: plan.tier },
      update: data,
      create: { tier: plan.tier, ...data },
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

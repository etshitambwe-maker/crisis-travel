import { NextResponse } from 'next/server';
import axios from 'axios';

async function ping(name: string, url: string) {
  const t0 = Date.now();
  try {
    await axios.get(url, { timeout: 3000 });
    return { name, status: 'ok' as const, latencyMs: Date.now() - t0 };
  } catch {
    return { name, status: 'down' as const, latencyMs: Date.now() - t0 };
  }
}

export async function GET(): Promise<NextResponse> {
  const checks = await Promise.all([
    ping('Frankfurter', 'https://api.frankfurter.app/latest'),
    ping('World Bank', 'https://api.worldbank.org/v2/country/TH/indicator/PV.EST?format=json&mrv=1'),
    ping('ReliefWeb', 'https://api.reliefweb.int/v1/reports?appname=crisis-travel&limit=1'),
    ping('FCDO', 'https://www.gov.uk/api/content/foreign-travel-advice/thailand'),
  ]);

  const allOk = checks.every((c) => c.status === 'ok');
  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      apis: checks,
      env: {
        anthropic: !!process.env.ANTHROPIC_API_KEY,
        perplexity: !!process.env.PERPLEXITY_API_KEY,
        redis: !!process.env.UPSTASH_REDIS_REST_URL,
        acled: !!process.env.ACLED_ACCESS_KEY,
        numbeo: !!process.env.NUMBEO_API_KEY,
      },
      checkedAt: new Date().toISOString(),
    },
    { status: allOk ? 200 : 207 }
  );
}

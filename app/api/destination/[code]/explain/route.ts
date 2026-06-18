import { NextResponse } from 'next/server';

// AI-COST-001 (P0-B) : route debug/dev désactivée.
// Aucune référence frontend trouvée lors de l'audit (grep explique zéro résultat hors ce fichier).
// Appelait calculateCrisisScore + generateDestinationNarrative (Claude) sans auth ni quota.
// Retourne 410 Gone pour signaler clairement que la route est morte — pas un 404 qui pourrait
// laisser croire à une faute de frappe de chemin.
export async function GET(
  _req: Request,
  _ctx: { params: Promise<{ code: string }> },
): Promise<NextResponse> {
  console.log('[API/explain] legacy route disabled (AI-COST-001 P0-B)');
  return NextResponse.json(
    { error: 'Cette route n\'est plus disponible.' },
    { status: 410 },
  );
}

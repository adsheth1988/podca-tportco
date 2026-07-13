import { NextResponse } from "next/server";
import { auth, OWNER_EMAILS } from "@/auth";
import { approveEmail, listApproved } from "@/lib/db/approvals";

// Promotes a waitlist signup (src/lib/waitlist.ts) into real sign-in access
// (src/lib/db/approvals.ts). proxy.ts already gates /api/admin/:path* behind
// auth, but these routes re-check OWNER_EMAILS directly — an approved,
// non-owner user must never be able to approve others.
async function requireOwner(): Promise<boolean> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  return !!email && OWNER_EMAILS.includes(email);
}

export async function GET() {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }
  return NextResponse.json({ approved: await listApproved() });
}

export async function POST(req: Request) {
  if (!(await requireOwner())) {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { email: toApprove } = await req.json();
  if (typeof toApprove !== "string" || !toApprove.includes("@")) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  await approveEmail(toApprove);
  return NextResponse.json({ ok: true });
}

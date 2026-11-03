import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSubAccountBalance, registerSubAccount } from "@/lib/doku-subaccount";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authorized" }, { status: 401 });

  const { data: account } = await supabase.rpc("get_my_doku_subaccount");
  if (!account) return NextResponse.json({ account: null });

  try {
    const accounts = await getSubAccountBalance(account.profile_id, [account.account_no_idr]);
    return NextResponse.json({ account, balance: accounts[0] ?? null });
  } catch (err) {
    return NextResponse.json({ account, balance: null, balanceError: (err as Error).message });
  }
}

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "not_authorized" }, { status: 401 });

  const { data: existing } = await supabase.rpc("get_my_doku_subaccount");
  if (existing) return NextResponse.json({ account: existing });

  const fullName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "BBB Organizer";
  const phone = (user.user_metadata?.phone as string | undefined) ?? "";

  try {
    const registered = await registerSubAccount({
      partnerReferenceNo: user.id,
      email: user.email ?? "",
      name: fullName,
      phoneNo: phone,
    });
    const { data: saved, error } = await supabase.rpc("upsert_my_doku_subaccount", {
      p_profile_id: registered.profileId,
      p_account_no_idr: registered.accountNoIdr,
      p_account_no_pending_idr: registered.accountNoPendingIdr,
    });
    if (error) throw error;
    return NextResponse.json({ account: saved });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}

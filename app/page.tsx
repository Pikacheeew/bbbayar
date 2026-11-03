import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const USE_CASES = [
  {
    title: "Travel Collection",
    blurb:
      "Planning a group trip? Pool travel funds from everyone, track who's paid, and split the total cost fairly once it closes.",
  },
  {
    title: "Sport & Activity Payments",
    blurb:
      "Weekly badminton, futsal, or gym session? Collect a fixed entry fee per person, every time, without chasing anyone down.",
  },
  {
    title: "Pre-order Business (Food & Fashion)",
    blurb:
      "Taking pre-orders with a cutoff time? Set a deadline, collect payment upfront, and know exactly how many to prepare.",
  },
  {
    title: "Jastip (Buy-for-you service)",
    blurb:
      "Buying from abroad or another city for friends? Collect payment per item before you shop — stop fronting the money yourself.",
  },
];

const VALUES = [
  { title: "Reduce fraud", blurb: "Real tracked payments, not screenshots of bank transfers to verify by hand." },
  { title: "Payment integrated", blurb: "Built-in QRIS payment for every participant — no manual proof-of-transfer chasing." },
  { title: "Shipping integrated", blurb: "Real GoSend/Grab and JNT rates, not a guess — quoted live from the buyer's own address." },
  { title: "Low cut fees", blurb: "A transparent, low admin fee per order — no hidden platform cuts." },
];

export default function Home() {
  return (
    <div className="flex-1 px-4 py-12 sm:px-6">
      <div className="mx-auto w-full max-w-2xl text-center">
        <div className="flex justify-center">
          <Badge className="border-transparent bg-amber-100 text-amber-800">🚀 Beta launch</Badge>
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          BBB, Bayar Bareng Bareng
        </h1>
        <p className="mt-1 text-sm font-medium text-muted-foreground">Collect payment together.</p>
        <p className="mt-3 text-balance text-muted-foreground">
          <span className="font-semibold text-foreground">Pledge</span> together for one
          thing, run a{" "}
          <span className="font-semibold text-foreground">Bulk Sell</span>, or take a{" "}
          <span className="font-semibold text-foreground">Pre-Order</span> with items,
          discounts, and shipping — everyone pays their own exact share, no spreadsheets, no
          chasing people down.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card className="flex flex-col p-5 text-left">
            <p className="font-medium text-foreground">New here? Sign up</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Create your account to start your own Pledge or Bulk Sell, or join one someone
              shared with you. One account covers both — organizing and joining.
            </p>
            <Button
              render={<Link href="/signup" />}
              nativeButton={false}
              size="lg"
              className="mt-4 w-full"
            >
              Create an account →
            </Button>
          </Card>

          <Card className="flex flex-col p-5 text-left">
            <p className="font-medium text-foreground">Already have an account? Log in</p>
            <p className="mt-1 flex-1 text-sm text-muted-foreground">
              Get back to your group buys — see what you still owe, pay your share, or check
              on orders you're collecting as the seller.
            </p>
            <Button
              render={<Link href="/login" />}
              nativeButton={false}
              variant="outline"
              size="lg"
              className="mt-4 w-full"
            >
              Log in →
            </Button>
          </Card>
        </div>
      </div>

      <div className="mx-auto mt-16 w-full max-w-4xl">
        <h2 className="text-center text-lg font-semibold text-foreground">
          Built for how people actually collect money
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {USE_CASES.map((useCase) => (
            <Card key={useCase.title} className="p-5 text-left">
              <p className="font-medium text-foreground">{useCase.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{useCase.blurb}</p>
            </Card>
          ))}
        </div>
      </div>

      <div className="mx-auto mt-16 w-full max-w-4xl">
        <h2 className="text-center text-lg font-semibold text-foreground">Why BBB</h2>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {VALUES.map((value) => (
            <Card key={value.title} className="p-4 text-left">
              <p className="text-sm font-medium text-foreground">{value.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{value.blurb}</p>
            </Card>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-12 max-w-2xl text-center text-xs text-muted-foreground">
        We&apos;re in beta — things may still be rough around the edges. Thanks for trying it
        early.
      </p>
    </div>
  );
}

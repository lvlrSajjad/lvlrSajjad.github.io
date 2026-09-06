# What connecting a mobile app to a Solana wallet looked like before the Mobile Wallet Adapter

*An engineering note about a prototype from May 2022, and what the platform did to it a month later.*

In May 2022 I spent a few weeks building a Flutter SDK that let a mobile app
ask a crypto wallet to sign a transaction. It worked on Ethereum. It did not
work on Solana, and the reason it didn't is the interesting part.

A month after I stopped, Solana announced the Solana Mobile Stack. The problem
I had been working around stopped existing. This is a note about the shape of
that problem, the design I picked, and why that design is the wrong one now —
written partly because I think the reasoning still transfers, and partly
because "I was six weeks early and the platform ate my lunch" is a normal
engineering outcome that nobody writes up.

## The problem, as it looked in May 2022

The ask was ordinary: a Flutter app, a button, and after the button a wallet
app that shows the user a transaction to approve. Three things made that hard
at the time.

**Chain SDKs assumed they were running in a browser or in Node.** Solana's
`@solana/web3.js` was a JavaScript library. So was `web3.js` for Ethereum. A
Flutter app is Dart, and there was no way to bring those libraries into the
process. Whatever built and submitted the transaction was going to have to run
somewhere other than the phone.

**WalletConnect v1 was an Ethereum protocol wearing a general-purpose name.**
It gave you a relay, a QR-code handshake, and a session — and then a JSON-RPC
surface that was, in practice, Ethereum's. Non-Ethereum chains were reached
through `sendCustomRequest` with hand-rolled method names, and whether a given
wallet answered was a per-wallet question with no way to ask in advance.

**Nothing on mobile connected an app to a wallet app locally.** The connection
went out to a relay server on the internet and came back, even when both
programs were installed on the same phone, inches apart.

## The design

Given that the chain SDK couldn't run on the phone, I put it on a server and
made the mobile SDK a thin client.

```
Flutter app  ──socket──▶  session server  ──WalletConnect relay──▶  wallet app
     │                          │
     │  QR / deep link          │  holds the WalletConnect session
     ◀──────────────────────────┘  builds the transaction
                                   talks to the chain RPC
```

The mobile side was deliberately small — about 350 lines of Dart. It opened a
socket, emitted `connect`, and rendered whatever the server told it to render:
a QR code for desktop-adjacent flows, or a deep link that handed off to a
wallet app installed on the same device. `transact` and `disconnect` worked the
same way. The SDK held no keys, built no transactions, and knew nothing about
any chain. It knew about four socket events.

The server held the WalletConnect session, persisted it so it survived a
restart, built transactions, and spoke to the chain's RPC endpoint.

Two things about that were genuinely good. Adding a chain meant touching only
the server — the mobile SDK never changed, because there was nothing
chain-shaped in it. And session persistence meant a user who connected once
stayed connected across app restarts, which was not free at the time.

One thing about it was quietly bad, and I want to be clear about it because it
is the reason the design is dead rather than merely dated: **a server that holds
the session and builds the transaction is a party to the transaction.** It
decides what the user is asked to sign. The user's wallet is the only thing
standing between that server and their funds. That is a lot of trust to put in
a relay whose only real job was to be somewhere `@solana/web3.js` could run.

## Where Solana stopped

Ethereum worked end to end. Connect, approve a spend in the wallet, get a hash
back.

Solana did not. The path I tried was WalletConnect v1's custom-request escape
hatch — send `solana_signTransaction` with a fee payer, instructions, and a
recent blockhash, and hope the wallet on the other end understood it. I never
got a wallet to answer. That code is still in the prototype, commented out,
below a `console.log` that does nothing. The only Solana code that ran was a
demo that generated two throwaway keypairs and transferred lamports between
them — which proves the RPC client worked and proves nothing at all about
wallet signing, since no user's wallet was ever involved.

So the honest scoreboard is: the architecture worked, on one chain, and Solana
was an unfinished branch when I put it down.

## What the Mobile Wallet Adapter did to all of this

Solana announced the Solana Mobile Stack in June 2022. The piece that matters
here is the [Mobile Wallet Adapter](https://docs.solanamobile.com/developers/mobile-wallet-adapter),
and it inverts the design above on every axis:

- **It is local.** On Android, an app hands off to a wallet app through the OS.
  No relay, no server, no round trip to the internet to reach a program on the
  same phone.
- **It is a real specification with a versioned protocol,** so "does this
  wallet support this?" has an answer before you send the request, instead of
  being discovered by silence.
- **There is a Flutter SDK.** The [Espresso Cash](https://github.com/espresso-cash/espresso-cash-public)
  team maintains [`solana`](https://pub.dev/packages/solana) (transaction codec
  and JSON-RPC) and [`solana_mobile_client`](https://pub.dev/packages/solana_mobile_client)
  (an MWA client) on Solana Foundation grants. The reason I needed a server —
  that the chain SDK couldn't run in Dart — is now a line in `pubspec.yaml`.

And WalletConnect v1, the transport the whole prototype rode on, was shut down
in 2023.

So the architecture isn't just superseded, it's inverted. The server-held
session was the clever part in May 2022 and it is the first thing you would
delete today, because MWA makes the wallet handoff local and keyless and the
server can only add a trust boundary that no longer buys anything.

The one place the old shape still rhymes with reality is iOS, where there's no
Seed Vault, no dApp Store, and the handoff runs through Safari or local deep
links rather than Android's app-to-app path. But WalletConnect v2 and wallets'
own deep-link schemes cover that, and I don't think it's an open gap. It's a
thinner platform, not a missing protocol.

## What actually transfers

Three things I'd keep.

**"Where can this library physically run?" is an architectural question, not a
packaging one.** The entire design followed from `@solana/web3.js` being unable
to execute in a Dart process. I've hit the same constraint since in contexts
with no blockchain anywhere near them. It is worth asking early, because the
answer sets your topology.

**A thin client ages better than a thick one.** The 350-line Dart SDK knew
about four socket events and no chains. It's the only part of the prototype I'd
still defend, because a client that knows nothing is a client that doesn't have
to be rewritten when the thing it talks to changes. The server absorbed every
chain-specific decision, which is exactly where the churn happened.

**Check whether the platform is about to solve your problem.** I did not, and
the answer was "in about a month." A relay-based workaround for a missing
platform capability has a short shelf life by construction — the platform is
the competitor, and it wins. That's not an argument against building the
workaround. It's an argument for knowing what you're building and how long it's
for.

---

*The original prototype was client work and stays private; it also carries a
second contributor's product design, which isn't mine to publish. Nothing from
it is reproduced here. This note describes the architecture and what I learned,
which are mine.*

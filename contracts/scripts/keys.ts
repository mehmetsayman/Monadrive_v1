import { keccak256, toHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Prints the demo identities so they can be imported into MetaMask.
 *
 * These keys are derived from fixed labels that live in this repository, so they
 * are public by construction and always will be. They exist to make a demo
 * recordable - a garage's earnings card is only convincing if you can connect as
 * that garage. Never send anything you care about to these addresses.
 */

const DEMO = [
  { key: "monaddrive/demo-garage/v1/ahmet", label: "Ahmet Usta Oto Servis", role: "servis" },
  { key: "monaddrive/demo-garage/v1/yetkili", label: "Yetkili Servis Kadıköy", role: "servis" },
  { key: "monaddrive/demo-garage/v1/ekspertiz", label: "TrustPoint Ekspertiz", role: "servis" },
  { key: "monaddrive/demo-buyer/v1/1", label: "Demo alıcı 1", role: "alıcı" },
  { key: "monaddrive/demo-buyer/v1/2", label: "Demo alıcı 2", role: "alıcı" },
];

console.log("\n  UYARI: bunlar bu depodaki sabit metinlerden türetilen, herkese açık");
console.log("  test anahtarlarıdır. Bu adreslere değerli hiçbir şey göndermeyin.\n");

for (const account of DEMO) {
  const privateKey = keccak256(toHex(account.key)) as Hex;
  const { address } = privateKeyToAccount(privateKey);

  console.log(`  ${account.label}  (${account.role})`);
  console.log(`    adres  ${address}`);
  console.log(`    anahtar ${privateKey}\n`);
}

console.log("  MetaMask > Hesap menüsü > Hesap içe aktar > Özel anahtar\n");
console.log("  Usta panelinde kazancı göstermek için bir servis hesabını içe aktarın.");
console.log("  Ödeme akışını göstermek için bir alıcı hesabı kullanın — kendi ana");
console.log("  cüzdanınız hem sicil sahibi hem onaylı servis olduğu için raporları");
console.log("  ücretsiz görür ve ödeme ekranını hiç görmezsiniz.\n");

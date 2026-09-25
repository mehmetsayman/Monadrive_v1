<div align="center">

# MonadDrive

**İkinci el araçta kelimeye değil, kayda bakın.**

Her araç bir dinamik NFT. Servis geçmişi zincirde, kilometre geri alınamıyor.
Raporu okuyan öder, geçmişi yazan usta kazanır.

[![Monad](https://img.shields.io/badge/Monad-Testnet-836EF9?style=flat-square)](https://monad.xyz)
[![Kontrat](https://img.shields.io/badge/kontrat-0x530ae2...72de30-836EF9?style=flat-square)](https://testnet.monadexplorer.com/address/0x530ae2809c0828ea55a4a407903c4f9d0172de30)
[![Testler](https://img.shields.io/badge/testler-37%2F37-A0FF9E?style=flat-square)](#testler)
[![Sourcify](https://img.shields.io/badge/kaynak-doğrulandı-A0FF9E?style=flat-square)](https://sourcify.dev/server/repo-ui/10143/0x530ae2809c0828ea55a4a407903c4f9d0172de30)
[![Next.js](https://img.shields.io/badge/Next.js_16-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-836EF9?style=flat-square)](https://soliditylang.org)

</div>

**Hızlı geçiş:** [Problem](#problem) · [Ne yapıyor](#ne-yapıyor) · [Ekranlar](#ekranlar) ·
[Canlı kontrat](#canlı-kontrat) · [Deneyin](#deneyin) · [Mimari](#mimari) ·
[İki değişmez](#ürünü-taşıyan-iki-değişmez) · [Tasarım kararları](#tasarım-kararları) ·
[Gelir modeli](#gelir-modeli) · [Testler](#testler) · [Yerelde çalıştırma](#yerelde-çalıştırma) ·
[Güven varsayımları](#güven-varsayımları) · [Yol haritası](#yol-haritası)

---

## Problem

İkinci el araç alırken elinizde iki şey var: satıcının anlattıkları ve gösterge
panelindeki rakam. İkisi de değiştirilebilir.

Kilometre düşürmek bir kablo ve birkaç dakika meselesi. Kaza geçmişi, aracın
servis dosyasıyla birlikte kaybolabiliyor. Ekspertiz raporu aracın o günkü halini
anlatıyor — geçmişini değil. Alıcı, hayatının ikinci en büyük alışverişini
doğrulayamadığı bir anlatıya güvenerek yapıyor.

Sorun veri eksikliği değil. Veri var: her bakım bir serviste, her kaza bir
tutanakta kayıtlı. Sorun bu kayıtların **dağınık, silinebilir ve sahibinin
kontrolünde** olması.

## Ne yapıyor

MonadDrive her aracı tek bir ERC-721 token'ı olarak temsil ediyor. Token kimliği
şasi numarasından türüyor, yani camdaki numarayı bilen herkes aracı sorgulayabiliyor.

Sorgu iki katmanlı: **önizleme herkese açık** — aracın sicilde olduğu, güncel
kilometresi, kaç kayıt ve kaç kaza taşıdığı, cüzdan istemeden görünüyor.
**Tam rapor ücretli**: 100 üzerinden sağlık skoru, kayıtların tarihleri,
notları, hangi servisin yazdığı ve fotoğrafları. Bir kez ödenir, o araç o
cüzdanda kalıcı olarak açılır.

Skor bilerek duvarın arkasında: alıcının tek bakışta almak istediği cevap o, ve
ücretsiz katmanın işi cevabı vermek değil, cevabın var olduğunu göstermek. Boş
bir skor halkası ve "? / 100" bunu yapıyor.

Sanayideki usta işi bitirdiğinde telefonundan kaydı giriyor: şasi no, kilometre,
işlem tipi, tarih, isterse fotoğraf. Araç sicilde yoksa aynı ekrandan sicile
açıyor. Kayıt bir saniyenin altında zincire yazılıyor ve bir daha
değiştirilemiyor.

Monad'ın sub-second finality'si burada süs değil, ürünün ön şartı: bir ustanın
müşteriyi bekletirken blok onayı için 15 saniye beklemesi gerekiyorsa o sistem
sanayide kullanılmaz.

## Ekranlar

### Alıcı sorgulama paneli

Şasi numarasıyla açılıyor. Üst bant ve güven kartı herkese açık; servis geçmişi
ödeme duvarının arkasında.

![Alıcı paneli — kilitli rapor](docs/screenshots/paywall.png)

Ödemeden sonra aynı alan, aracın doğduğu günden bugüne dikey zaman çizelgesine
dönüşüyor: her kaydın tarihi, kilometresi, notu ve onu imzalayan servisin adı,
explorer bağlantısıyla birlikte.

### Giriş

![Giriş ekranı](docs/screenshots/landing.png)

### Usta / servis paneli

Mobil odaklı, tek kolon, tek buton. Sanayide tek elle tutulan bir telefon için.

Panel iki işi de yapıyor. Sicilde olan bir şasi numarasında kayıt ekliyor; sicilde
**olmayan** bir numarada ise "ilk kaydı siz açıyorsunuz" moduna geçiyor ve aracı
sicile kaydediyor. Bir aracın sicile ilk kez girmesi de ustanın işi, ve girilen
ilk kilometre aracın taban değeri oluyor — bundan sonra hiçbir servis altına
inemiyor.

<div align="center">
  <img src="docs/screenshots/report.png" alt="Usta paneli" width="300" />
</div>

> Arayüz Türkçe: ürün Türkiye'deki ikinci el araç piyasasını hedefliyor ve
> kullanıcısı sanayideki usta. Kod ve yorumlar İngilizce.

## Canlı kontrat

| | |
|---|---|
| **Ağ** | Monad Testnet (chainId `10143`) |
| **Sicil kontratı** | [`0x530ae2809c0828ea55a4a407903c4f9d0172de30`](https://testnet.monadexplorer.com/address/0x530ae2809c0828ea55a4a407903c4f9d0172de30) |
| **RPC** | `https://testnet-rpc.monad.xyz` |
| **Explorer** | [testnet.monadexplorer.com](https://testnet.monadexplorer.com) |
| **Doğrulanmış kaynak** | [Sourcify](https://sourcify.dev/server/repo-ui/10143/0x530ae2809c0828ea55a4a407903c4f9d0172de30) — kontratı okuyup buradaki iddiaları kendiniz kontrol edebilirsiniz |

Zincirde şu an dört demo aracı ve 18 gerçek kayıt duruyor.

## Deneyin

Önizleme cüzdan istemiyor. Şu şasi numaralarını deneyin:

| Şasi numarası | Ne göreceksiniz |
|---|---|
| `WVWZZZ1JZXW000001` | Bakımlı, kazasız — skor **100**, 6 kayıt |
| `NM0GE9F79E1234567` | Hafif kazalı — skor **86**, 1 kaza |
| `1HGBH41JXMN109186` | Ağır hasarlı — skor **53**, 2 kaza, şasi deformasyonu |
| `TMBJJ7NE0J0123456` | Sicile yeni girmiş — geçmişi henüz oluşuyor |
| başka bir şey | Sicilde olmayan araç ekranı |

Tam raporu açmak için cüzdan bağlayıp 0.05 MON ödemeniz gerekiyor. Kayıt girmek
içinse cüzdanınızın yetkili servis olarak onaylanmış olması gerekiyor (aşağıda
[yerelde çalıştırma](#yerelde-çalıştırma)).

## Mimari

```
┌────────────────────────┐   ┌──────────────────────────────────────┐
│  Usta paneli (mobil)   │   │      Alıcı paneli (masaüstü)         │
│  /report               │   │      /vehicle/[vin]                  │
│  wagmi · cüzdan gerekli│   ├──────────────────┬───────────────────┤
│                        │   │ Önizleme         │ Tam rapor         │
│                        │   │ sunucuda okunur  │ ödeme sonrası     │
│                        │   │ cüzdansız        │ tarayıcıda okunur │
└───────────┬────────────┘   └────────┬─────────┴─────────┬─────────┘
            │ addRecordByVin()        │ getVehicleSummary │ purchaseReport()
            │ withdrawEarnings()      │ reportSplit       │ getRecords()
            │                         │ (multicall3)      │ erişim varsa
      ┌─────▼─────────────────────────▼───────────────────▼─────┐
      │               VehicleRegistry.sol                       │
      │  ERC-721 · Record[] · skor · servis yetkisi             │
      │  erişim hakkı · gelir bölüşümü                          │
      │  tokenId = keccak256(şasi no)                           │
      └──────────────────────────┬──────────────────────────────┘
                                 │ ipfsCid
                         ┌───────▼────────┐
                         │  IPFS (Pinata) │  fotoğraf ve fatura
                         └────────────────┘
```

**Neden `tokenId = keccak256(şasi no)`:** Alıcı, zincir dışı hiçbir dizine
ihtiyaç duymadan camdaki numarayla aracı buluyor. Şasi numarasının kendisi
zincire hiç yazılmıyor, yalnızca özeti tutuluyor. Aynı araç iki kez kaydedilemiyor
— ERC-721 zaten reddediyor.

**Neden subgraph yok:** Kontrat `getVehicleSummary` ve `getRecords` view'leri ile
bir sayfanın ihtiyacı olan her şeyi veriyor. Monad testnet'te Multicall3 deploy
edilmiş durumda, bu yüzden özet, kayıtlar, NFT görseli ve her servisin adı tek bir
`eth_call` içinde geliyor. Hackathon süresinde indexer kurmak tuzak.

## Ürünü taşıyan iki değişmez

Projenin tamamı iki kurala dayanıyor. Geri kalan her şey bu ikisinin sunumu.

### 1. Kilometre geri alınamaz

```solidity
if (mileage < v.lastMileage) revert MileageRollback(v.lastMileage, mileage);
```

Düşük kilometre girme denemesi bir uyarı, bir bayrak veya sonradan fark edilecek
bir tutarsızlık değil — **hiç gerçekleşmeyen bir işlem.** Zincir onu baştan
reddediyor, kayıt defterine hiç girmiyor.

### 2. Hasar puanı azalmaz

Kaza ve ağır hasar kayıtları kalıcı hasar puanı ekliyor. Düzenli bakım puan
kazandırıyor ama **en fazla 10 puan** telafi edebiliyor:

```solidity
uint16 public constant MAX_CARE_BONUS = 10;
```

Yani kazalı bir araç, arka arkaya yağ değişimi kaydı girilerek temize
çıkarılamıyor. Sağlık skoru şöyle hesaplanıyor:

| İşlem tipi | Hasar | Bakım puanı |
|---|---|---|
| Periyodik bakım | — | +2 |
| Muayene / ekspertiz | — | +1 |
| Parça değişimi | +2 | +1 |
| Onarım | +5 | — |
| Kaza kaydı | +15 | — |
| Ağır hasar | +30 | — |

Geçmiş yalnızca ekleniyor. Bir servisin yetkisi alındığında imzaladığı kayıtlar
yerinde kalıyor: lisansını kaybetmek, daha önce söylediklerini silmiyor.

## Tasarım kararları

**Metadata zincirde üretiliyor.** `tokenURI` base64 JSON ve gömülü SVG döndürüyor;
görsel ve özellikler her yeni kayıtla değişiyor. "Dinamik NFT" burada mecaz değil
— sonradan içeriği değiştirilebilecek bir dosyaya işaret edilmiyor. Bunun bedeli
`viaIR` ile derleme zorunluluğu oldu.

**İşin yapıldığı gün, kayda geçtiği günden ayrı.** `Record` iki tarih taşıyor:
`recordedAt` (zincirin kaydı kabul ettiği an) ve `serviceDay` (işin yapıldığı
gün). Usta geçen ayki işi bugün girebilir ve o iş bugün yapılmış sayılamaz.
`serviceDay` epoch'tan itibaren tam gün sayıyor; bir servis tarihi için gereken
hassasiyet bu kadar ve struct'ın tek storage slotuna sığmasını sağlayan da bu:

```
recordedAt(5) + serviceDay(2) + mileage(4) + recordType(1) + reporter(20) = 32 bayt
```

**Önizleme cüzdan istemiyor, rapor istiyor.** Galeride araca bakan alıcının
cüzdanı yok; ona önce bir şey göstermek gerekiyor. Önizleme sunucuda okunuyor ve
paylaşılabilir bir link olarak kalıyor. Cüzdan ve ödeme ancak raporu açmak
istendiğinde devreye giriyor.

**Kilitli yarı sunucuda hiç yüklenmiyor.** Kayıtlar, zincir o cüzdanın erişimi
olduğunu söyledikten sonra tarayıcıda okunuyor. Sunucuda çekip CSS ile gizlemek,
tüm raporu sayfa kaynağına koymak olurdu — kapı ancak görüntü kaynağında da
kapalıysa kapıdır.

**Usta paneli kilometre geri alımını formda yakalıyor.** Kontrat zaten
reddedecek; panel aynı "hayır"a imza atmadan önce varıyor. Şasi numarası
yazılırken zincirdeki son kilometre okunuyor ve daha düşük bir değer kırmızıya
dönüyor.

**Onay süresi sayacı insanı değil ağı ölçüyor.** Kronometre butona basınca değil
imza atıldıktan sonra başlıyor, böylece ekrandaki rakam Monad'ın gecikmesi —
kullanıcının tereddüdü değil.

## Gelir modeli

Alıcı bir aracın tam raporunu açtığında **0.05 MON** ödüyor. Bu ücret zincirde,
tek işlemde bölüşülüyor:

| Kime | Pay | Neye göre |
|---|---|---|
| Geçmişi yazan servisler | **%70** | O araçta kaç kayıt yazdıklarıyla orantılı |
| Platform | **%30** | Sabit |

Bir servis o araçtaki 5 kaydın 3'ünü yazdıysa, servis payının 3/5'ini alıyor.
Ödemeler kontratta biriktiriliyor ve herkes kendi bakiyesini `withdrawEarnings`
ile çekiyor — bir alıcının ödemesi, ödeme alamayan bir adres yüzünden
takılmıyor.

**Bu neden önemli:** "Usta neden oturup bunu telefona girsin?" sorusunun cevabı
bu. Yazdığı kayıt okundukça kazanıyor. Sicil ne kadar dolu olursa raporlar o
kadar değerli, raporlar değerlendikçe usta o kadar çok kazanıyor.

Fiyat ve pay oranı kontrat sahibi tarafından değiştirilebiliyor
(`setReportPrice`, `setPlatformShare`).

Rapor üç durumda ücretsiz: aracın NFT sahibi kendi aracının geçmişini görüyor,
onaylı servisler üzerinde çalışacakları aracı görüyor, ve herkes önizlemeyi
görüyor.

## Testler

37 test, hepsi geçiyor:

```
npm --prefix contracts test
```

Kapsananlar: ödeme (erişim kilidi, kalıcılık, çift ödeme reddi, eksik ödeme,
fazla ödemenin iadesi, araç sahibine ve servise ücretsiz erişim, **bölüşümün
kayıt sayısına göre ağırlıklandırılması**, çekim, yetkisiz fiyat değişikliği),
yetkilendirme (yetkisiz yazma, yetkisi alınmış servis, yetkisi
alınan servisin geçmişinin korunması), kayıt (çift kayıt reddi, kayıtsız araca
yazma), **kilometre garantisi** (ileri kabul, eşit kabul, geri reddi, red sonrası
verinin bozulmaması), **servis tarihi** (sonradan girilen kaydın tarihini koruma,
sıfırın bugüne çevrilmesi, gelecek tarih reddi), skor (kaza düşüşü, bakım
spam'ine karşı tavan), okuma (bilinmeyen şasi boş durum, sayfalama, servis adı)
ve dinamik metadata (yeni kayıtla değişmesi).

Canlı zincirde ölçülen yazma süreleri (21 işlem): en hızlı **370 ms**, medyan
**701 ms**.

## Yerelde çalıştırma

**Gereksinimler:** Node 20+, bir MetaMask cüzdanı ve
[faucet.monad.xyz](https://faucet.monad.xyz) veya
[QuickNode faucet](https://faucet.quicknode.com/monad/testnet) üzerinden alınmış
test MON.

```bash
git clone https://github.com/mehmetsayman/Monadrive_v1.git
cd Monadrive_v1

# 1. Kontratlar
cd contracts
npm install
npm test                       # 37 test, zincire bağlanmadan çalışır

cp .env.example .env           # MONAD_PRIVATE_KEY satırını doldurun
npm run deploy                 # Monad Testnet'e çıkar
npm run seed                   # dört demo aracını geçmişiyle yazar

# kendi cüzdanınıza yazma yetkisi verin
GARAGE=0xADRESINIZ GARAGE_NAME="Servis adı" npm run approve

# 2. Arayüz
cd ../web
npm install
npm run sync:contract          # kontrat adresini ve ABI'yi kopyalar
npm run dev                    # http://localhost:3000
```

### Demo ve bakım komutları

Hepsi `contracts/` içinde çalışır.

| Komut | Ne yapar |
|---|---|
| `npm run status` | Kasada ne var, kim ne kazandı, son satışlar. Gas ile satış gelirini ayrı gösterir |
| `npm run newcar` | Tertemiz bir araç kaydeder ve şasi numarasını verir |
| `npm run roles` | `USTA` ve `MUSTERI` adreslerini rollere bağlar, fonlar, çakışan yetkileri temizler |
| `npm run buy` | Demo alıcı olarak bir rapor satın alır, bölüşümü yazdırır |
| `npm run keys` | Seed'in ürettiği demo servis cüzdanlarını yazdırır (MetaMask'e aktarmak için) |
| `npm run approve` | Bir adrese servis yetkisi verir veya alır |

> **Rapor erişimi araç başına kalıcıdır.** Bir cüzdan bir aracın raporunu bir kez
> açtıysa o araçta ödeme ekranı bir daha çıkmaz. Demo çekmeden önce
> `npm run newcar` çalıştırın.

Fotoğraf yükleme isteğe bağlı: `web/.env.local` içine `PINATA_JWT=...` eklerseniz
aktifleşir. Eklemezseniz uygulama çalışmaya devam eder, yalnızca fotoğraf alanı
yapılandırılmadığını söyler.

> `.env` dosyaları gitignore'da. Deploy için kullandığınız cüzdanı atılabilir bir
> testnet cüzdanı olarak tutun.

## Güven varsayımları

Dürüst olmak gerekirse zincir her şeyi çözmüyor. Sistemin sınırları:

- **Girdi doğruluğu.** Kontrat, yetkili bir servisin girdiği kilometrenin gerçek
  olduğunu doğrulayamaz. Garanti ettiği şey, bir kez girilen değerin bir daha
  düşürülemeyeceği ve kimin girdiğinin kayıtlı olduğu.
- **Yetkilendirme merkezi.** Servisleri şu an kontrat sahibi onaylıyor. Gerçek
  bir dağıtımda bunun yerine bir oda/birlik çoklu imzası veya itibar temelli bir
  mekanizma gerekir.
- **Sicile girmemiş araç.** Kayıtlı olmayan bir şasi numarası "temiz geçmiş"
  anlamına gelmiyor, yalnızca "henüz kimse girmemiş" anlamına geliyor. Arayüz bu
  ayrımı açıkça yapıyor.
- **IPFS kalıcılığı.** Fotoğraflar pinleniyor; pin düşerse CID zincirde kalır ama
  dosya erişilemez olabilir.
- **Ödeme duvarı gizlilik değil, üründür.** Kayıtlar herkese açık bir zincirde
  herkese açık storage'da duruyor; kontrata doğrudan çağrı yapan biri onları
  okuyabilir. Satılan şey veri değil, **rapor**: derlenmiş, okunabilir,
  kaynağı belli sunum. Uygulama kilitli veriyi sayfa kaynağına hiç koymuyor —
  kayıtlar ancak zincir o cüzdanın erişimi olduğunu söyledikten sonra tarayıcıya
  iniyor — ama bu bir ürün sınırı, kriptografik bir kilit değil. Gerçekten
  şifrelemek, ustanın tek tuşla kayıt girmesini ve geçmişin herkesçe
  doğrulanabilir olmasını bozardı; bu takas bilinçli.

## Yol haritası

- Servis itibar puanı: çok sayıda araçta tutarlı kayıt giren servisler öne çıksın
- Araç sahipliği devri (ERC-721 zaten destekliyor, arayüzü yok)
- Sigorta ve ekspertiz şirketleri için toplu sorgulama API'si
- Yetkilendirmenin çoklu imzaya taşınması

---

<div align="center">

Monad Testnet üzerinde çalışır · Solidity 0.8.28 · Hardhat 3 · Next.js 16 · wagmi + viem

</div>

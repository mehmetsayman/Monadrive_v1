# Demo senaryosu — 90 saniye

Hedef: jüri videoyu izledikten sonra tek bir cümleyi hatırlasın —
**"kilometre düşürme denemesi zincirde hiç gerçekleşmiyor."**

Sırayı bozmayın. Her parça bir öncekinin kurduğu beklentiyi kullanıyor.

---

## Hazırlık (kayda başlamadan önce)

- [ ] `npm run dev` çalışıyor, `http://localhost:3000` açık
- [ ] MetaMask **Monad Testnet**'te ve yetkili servis cüzdanıyla bağlı
- [ ] Cüzdanda en az 0.2 MON var
- [ ] Tarayıcı sekmeleri kapalı, bildirimler susturulmuş
- [ ] Telefon ekranı kaydı için `/report` açık (ikinci cihaz veya responsive mod)
- [ ] Şu üç şasi numarası panoda hazır:
  - `WVWZZZ1JZXW000001` (temiz)
  - `1HGBH41JXMN109186` (ağır hasarlı)

---

## 0:00 – 0:12 · Problem

**Ekran:** Giriş sayfası.

> "İkinci el araç alırken elinizde iki şey var: satıcının anlattıkları ve
> göstergedeki rakam. İkisi de değiştirilebilir. Kilometre düşürmek bir kablo ve
> beş dakika meselesi."

**Neden burada:** Teknolojiden önce acıyı kurun. Jüri "blokzincir" kelimesini
duymadan önce sorunu tanısın.

---

## 0:12 – 0:32 · Temiz araç

**Ekran:** `WVWZZZ1JZXW000001` yazın, Sorgula.

> "Şasi numarasını giriyorum. Cüzdan yok, kayıt yok, izin yok — bu herkese açık
> bir sicil."

Sayfa açılınca **skor halkasını** ve **zaman çizelgesini** gösterin.

> "2019'dan bugüne altı kayıt. Her satırın altında onu yazan servisin adı ve
> adresi var. Skor 100: hiç kaza kaydı yok."

**Neden burada:** Önce "iyi" hali gösterin ki kötü hali anlamlı olsun.

---

## 0:32 – 0:52 · Hasarlı araç

**Ekran:** `1HGBH41JXMN109186`.

> "Aynı sorgu, başka bir araç."

Skoru ve kırmızı rozeti gösterin, sonra çizelgede aşağı inin.

> "Skor 53. İki kaza kaydı. 2020'de ön şasi deformasyonu tespit edilmiş, on beş
> gün sonra düzeltme yapılmış. Bu araç satıcının anlatmayacağı şeyi kendisi
> anlatıyor."

Soldaki **"Geçmişi yazanlar"** kartını gösterin.

> "Üç farklı servis yazmış. Biri diğerini doğruluyor."

**Neden burada:** Ürünün değeri tam olarak bu ekran. Acele etmeyin.

---

## 0:52 – 1:12 · Usta kaydı giriyor

**Ekran:** Telefon, `/report`.

> "Peki bu kayıtlar oraya nasıl giriyor? Sanayideki usta, işi bitirdiğinde
> telefonundan."

Şasi numarasını yazın — **zincirden gelen son kilometrenin belirdiğini gösterin.**

> "Şasi numarasını yazdığım anda zincirdeki son kilometreyi okuyor."

Kilometre, işlem tipi, tarih girin. **Monad Ağına Kaydet.** MetaMask'te onaylayın.

Onay ekranındaki **milisaniye rakamını** gösterin.

> "Yedi yüz milisaniye. Bu Monad'ın onay süresi. Usta müşteriyi bekletmiyor —
> Web2 hızında çalışıyor ama kayıt Web3 güvencesinde."

**Neden burada:** Sub-second finality'yi anlatmayın, **ölçün ve gösterin.**

---

## 1:12 – 1:28 · Kapanış vuruşu

**Ekran:** Aynı formda kilometre alanına **daha düşük bir sayı** yazın.

Alan kırmızıya döner, altta uyarı çıkar.

> "Şimdi kilometreyi düşürmeyi deniyorum."

Kısa bir es verin.

> "Bu bir uyarı değil. Bir bayrak, sonradan fark edilecek bir tutarsızlık da
> değil. Zincir bu işlemi baştan reddediyor — kayıt defterine hiç girmiyor.
> Kilometre düşürmek MonadDrive'da mümkün olan ama yasak bir şey değil;
> **imkânsız bir şey.**"

**Neden burada:** Son cümle akılda kalan cümle. Bunu ezberleyin.

---

## 1:28 – 1:30 · Kapanış kartı

**Ekran:** Giriş sayfası veya logo.

> "MonadDrive. Kelimeye değil, kayda bakın."

---

## Yedek plan

- **Ağ yavaşlarsa:** Videoyu önceden kaydedin, canlı demo yedek olsun.
- **Cüzdan bağlanmazsa:** Alıcı paneli cüzdan istemiyor; 0:12–0:52 arası tek
  başına da hikâyeyi anlatır.
- **Süre taşarsa:** İlk kesilecek parça temiz araç (0:12–0:32). Hasarlı araç ve
  kilometre reddi asla kesilmez.

## Kesinlikle anlatmayın

- Kontrat mimarisi, struct paketleme, gas optimizasyonu — sorulursa anlatın
- "Blokzincir teknolojisi sayesinde..." ile başlayan hiçbir cümle
- Yol haritası — 90 saniyede geleceği değil bugünü satın

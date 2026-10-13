# Олон улсын SMS API-аар Монгол (+976) руу мессеж илгээх

Судалгааны огноо: 2026-10-14. Үнийг зөвхөн тухайн өдөр нээлттэй хуудаснаас уншсан тоогоор тэмдэглэв. Нэвтрэх шаардлагатай, тооцоолуурт гараагүй үнийг зохиож бичээгүй.

## Монгол (+976) дэмжигдсэн чиглэл үү, Unitel, Mobicom, Skytel, G-Mobile хүрэх үү?

### Takeaway
Twilio, Infobip, Bird (MessageBird), Vonage бүгд Монголыг (+976, MCC 428) дэмжигдсэн чиглэл гэж нээлттэй баримтжуулсан. Дөрвөн операторын нэрийг Plivo, Unimatrix, Messaggio, LINK Mobility, Cheap Global SMS тус тусад нь үнэ эсвэл sender жагсаалтад бичсэн тул олон улсын маршрутаар хүрнэ гэж үзэх үндэслэлтэй. Гэхдээ MNC код зөрүүтэй, Twilio олон улсын урт дугаарыг G-Mobile болон Mobicom дээр дэмжихгүй гэж тусад нь анхааруулсан.

### Cited Findings
- Twilio-ийн Монгол SMS заавар: улсын нэр Mongolia, ISO MN, бүс Asia, MCC 428, залгах код +976. Хоёр талын SMS дэмжигдэхгүй. Нэгтгэсэн (concatenated) мессеж дэмжинэ. MMS-ийг холбоостой SMS болгон хувиргана. — [Twilio Mongolia SMS Guidelines](https://www.twilio.com/en-us/guidelines/mn/sms)
- Twilio, үсэг-тоон sender ID: операторын сүлжээнд урьдчилсан бүртгэл «Not Required», Twilio дэмжинэ, sender ID хадгалагдана (preserved = Yes), UCS-2 дэмжинэ. — [Twilio Mongolia SMS Guidelines](https://www.twilio.com/en-us/guidelines/mn/sms)
- Twilio, олон улсын урт дугаар: «Not Supported for G-Mobile and Mobicom», «Supported for the rest of Mongolia networks». Дотоодын урт дугаар болон short code Twilio дээр дэмжигдэхгүй. Практик зөвлөмж: G-Mobile болон Mobicom руу олон улсын урт дугаар ашиглахаа больж, брэндийн үсэг-тоон sender ID ашигла. — [Twilio Mongolia SMS Guidelines](https://www.twilio.com/en-us/guidelines/mn/sms)
- Infobip-ийн хамрах хүрээний хүснэгтэд Mongolia тусдаа мөрөөр бичигдсэн: бүс Eastern Asia, улсын код MN, залгах код 976, MCC 428, дугаар зөөхгүй. Үсэг-тоон sender дотоод болон олон улсын аль алинд нь Yes. Богино код No/No. Урт тоон sender Yes/Yes. Sender бүртгэл шаардлагагүй (LOCAL: No, INTERNATIONAL: No). URL зөвшөөрнө. Хориглосон сэдэв: Phishing. Хоёр талын SMS: No. Дотоод/олон улсын урсгалыг тусад нь ангилахгүй (Traffic Origin Classification = No). — [Infobip SMS coverage and connectivity](https://www.infobip.com/docs/sms/sms-coverage-and-connectivity)
- Infobip-ийн өөрөө бүртгүүлэх SMS хамрах хүрээ дэлхий даяар, хассан улсууд: Belarus, British Indian Ocean Territory, China, Crimea, Cuba, Iran, Myanmar, New Zealand, North Korea, Northern Cyprus, South Sudan, Syria, Yemen. Монгол энэ хасалтын жагсаалтад байхгүй. — [Infobip SMS docs](https://www.infobip.com/docs/sms)
- Bird: Монгол руу SMS, улсын код MN, залгах код +976, суваг sms/whatsapp/voice, хоёр тал үгүй. Үсэг-тоон sender ID, чиглэл one-way, бүртгэл none, sender ID хадгалагдана. Бодлогын лавлагаа шинэчлэгдсэн огноо 2026-07-13. Загвар урьдчилан батлах шаардлагагүй. — [Bird SMS to Mongolia](https://bird.com/sms-api/features/destinations/mongolia)
- Vonage: Mongolia, ISO MN, улсын код 976, бүс Asia, MCC 428. Үсэг-тоон болон тоон sender ID дэмжинэ. INFO, SMS, NOTICE зэрэг ерөнхий sender хориглоно. Маркетинг илгээхийн өмнө гар утасны хэрэглэгчийн opt-in зөвшөөрөл хэрэгтэй. P2P хориглоно. Улс төр, шашин, хүсээгүй сурталчилгаа, мөрийтэй тоглоомын агуулга хориглоно. Нийтлэлийн огноо 2023-08-02 (Marcus Tan). — [Vonage Mongolia SMS Features](https://api.support.vonage.com/hc/en-us/articles/218931478-Mongolia-SMS-Features-and-Restrictions)
- Plivo Монголын сүлжээний үнэд дөрвөн операторыг нэрлэсэн: G mobile net Co. Ltd, MobiCom, Skytel, Unitel, мөн «Mongolia-Others». — [Plivo SMS pricing Mongolia](https://www.plivo.com/sms/pricing/mn/)
- Unimatrix Монголын үнэд Mobicom (MCC 428, MNC 99, PLMN 42899), Unitel (428/88/42888), Skytel (428/00/42800), G-Mobile (428/98/42898), бусад (428) гэж бичсэн. Залгах код +976, MCC 428. — [Unimatrix Mongolia SMS](https://www.unimtx.com/sms/mn)
- Messaggio Монголын үнэд G-MOBILE, MOBICOM, SKYTEL, UNITEL гэж дөрвүүлэнг нь бичсэн. Үнэ нь тооцоо (estimate) бөгөөд яг үнийг дансны менежерээс асуухыг сануулсан. — [Messaggio SMS Gateway Mongolia](https://messaggio.com/sms-gateway-api/mongolia/)
- LINK Mobility, сүүлд шинэчилсэн 2026-04-30: «No measures exist». Оператор: G-Mobile MNC 6 (тоон, үсэг-тоон, short code бүгд Yes), MobiCom MNC 99 (тийм), Skytel MNC 1 (тийм), Unitel MNC 88 (тийм). Урт дугаар, тусгай болон хуваалцсан short code, үсэг-тоон sender боломжтой. «No registration is necessary or feasible for this destination.» — [LINK Mobility Mongolia sender ID](https://docs.linkmobility.com/regulatory-guidelines/sender-id/mongolia)
- Cheap Global SMS дөрвөн сүлжээ: MobiCom 42899, Unitel 42888, GMobile 42806, Skytel 42801. — [Cheap Global SMS Mongolia](https://cheapglobalsms.com/bulk-sms-to/MN/mongolia)
- SMS.to Монгол руу gateway санал болгосон хуудастай (OTP, мэдэгдэл, маркетинг). Татаж уншсан хуудсанд Unitel, Mobicom, Skytel, G-Mobile гэсэн операторын нэр байгаагүй. Үнийг SMS pricing хуудас руу чиглүүлсэн. — [SMS.to Mongolia](https://sms.to/bulk/mongolia/)

### Inferences
- Дөрвөн оператор олон улсын A2P маршрутад «хүрэхгүй» гэсэн нотолгоо олдсонгүй. Харин эсрэгээр хэд хэдэн гарц тэднийг үнэ, sender хүснэгтэд нэрлэсэн. Twilio-ийн хязгаар нь «хүрэхгүй» биш, G-Mobile болон Mobicom дээр олон улсын урт дугаар ашиглахгүй, үсэг-тоон нэр ашигла гэсэн sender-ийн хязгаар.
- MNC зөрүү (G-Mobile 98 эсвэл 06/6, Skytel 00 эсвэл 01/1) нь оператор байхгүй гэсэн үг биш. Нийтийн баримтад хуучин болон одоогийн сүлжээний код холилдсон байж болно. Хүргэлтийг MNC-ээр шүүх бол гарцын өөрийн lookup-оор шалгах хэрэгтэй.

### Gaps
- Twilio, Infobip, Bird, Vonage-ийн нээлттэй Монгол хуудсанд дөрвөн операторын хүргэлтийн хувь (delivery rate) эсвэл «энэ MNC руу 2026 онд амжилттай» гэсэн хэмжилт байхгүй.
- SMS.to Монгол хуудас чиглэлийг зарласан боловч оператор тус бүрийн хамрах хүрээг нээлттэй жагсаагаагүй.
- Vonage-ийн Монгол заавар 2023-08-02-ны өмнөх нийтлэл. 2026 оны 10 сарын байдлаар шинэчлэгдсэн эсэхийг энэ хуудаснаас баталгаажуулсангүй.

## Монгол руу гарах SMS-ийн үнэ (USD, сегмент), үсэг-тоон sender, бүртгэл

### Takeaway
Нээлттэй, операторгүй нэг үнэ: Twilio $0.3541/сегмент (олон улсын дугаар болон үсэг-тоон sender адилхан). Bird-ийн pay-as-you-go хуудас үсэг-тоон sender-т $0.26/сегмент гэж буцаасан. Plivo сүлжээгээр $0.2800–$0.3500/SMS. Unimatrix дөрвөн операторт адилхан $0.1986/мессеж. Infobip, Vonage, SMS.to-ийн Монголд зориулсан USD үнэ нээлттэй хуудсанд гараагүй. Үсэг-тоон sender-ийг эдгээр гарц бүртгэлгүй, хадгалагдана гэж бичсэн байгаа нь давхцаж байна. Short code болон олон улсын дугаарын дэмжлэг гарц бүрт зөрнө.

### Cited Findings
- Twilio Монгол: International Numbers гарах SMS $0.3541, Alphanumeric Sender IDs гарах SMS $0.3541. «Text messages are charged per segment.» Үнэ мэдэгдэлгүйгээр өөрчлөгдөж болно, нэмэлт carrier fee авч болно. «Failed» төлөвтэй мессежид $0.001 боловсруулалтын хураамж. Орох SMS, MMS үнэ хүснэгтэд хоосон. Үсэг-тоон sender ID-ийн сарын түрээс Free. Олон улсын дугаарын түрээс «Starting at $1.15/mo». Нэмэлт: Engagement Suite $0.015 (сар бүрийн эхний 1,000 үнэгүй), SMS pumping protection $0.025. Эхлүүлэхэд карт шаардахгүй гэсэн маркетингийн мөр бий. — [Twilio SMS pricing Mongolia](https://www.twilio.com/en-us/sms/pricing/mn)
- Twilio үсэг-тоон: урьдчилсан бүртгэл шаардлагагүй, dynamic дэмжинэ, sender хадгалагдана. Олон улсын урт дугаар G-Mobile, Mobicom дээр дэмжигдэхгүй. — [Twilio Mongolia SMS Guidelines](https://www.twilio.com/en-us/guidelines/mn/sms)
- Bird pay-as-you-go үнэ (USD, илгээсэн мессеж, sender төрлөөр): Mongolia MN, Alphanumeric $0.26, Long code «not published», Toll-free «not published», Short code «not published». «Prices are charged per message segment.» Хүснэгт нь Bird-ийн үнэ, carrier fee-г тусад нь гэж тайлбарласан боловч Монголын мөрөнд carrier fee-ийн тоо байхгүй. Утасны дугаар түрээслэвэл давтагдах төлбөр тусдаа. — [Bird SMS pricing Mongolia](https://bird.com/en-us/products/sms/pricing/mn)
- Bird Monthly Targeted Contacts (Engagement Platform, шинэ API эсвэл pay-as-you-go биш): Mongolia $0.2121, тэмдэглэл «Carrier fees apply on top». — [Bird SMS MTC pricing](https://bird.com/en-us/pricing/sms/mtc)
- Bird sender: үсэг-тоон, бүртгэлгүй, илгээсэн нэр хадгалагдана, зөвхөн нэг тал. — [Bird SMS to Mongolia](https://bird.com/sms-api/features/destinations/mongolia)
- Plivo, урт код гарах SMS «Starts at $0.2800/sms». Сүлжээ: G mobile net Co. Ltd $0.2800/sms, Unitel $0.2875/sms, Skytel $0.3000/sms, MobiCom $0.3500/sms, Mongolia-Others $0.3500/sms. Орох SMS: Contact support. Нэгж нь хуудсан дээр «/sms», «per segment» гэж бичээгүй. — [Plivo SMS pricing Mongolia](https://www.plivo.com/sms/pricing/mn/)
- Unimatrix: «US$ 0.1986 per message». Mobicom, Unitel, Skytel, G-Mobile, Others бүгдэд transactional $0.1986, promotional $0.1986. — [Unimatrix Mongolia SMS](https://www.unimtx.com/sms/mn)
- Unimatrix API: `signature` нь SMS sender нэр, 2–16 тэмдэгт, заавал биш. Ихэнх улсад sender нэмэх шаардлагагүй, шаардлагатай улсад платформ төвийг сахисан sender онооно гэж ерөнхий зааварт бичсэн. Монголд бүртгэл шаардлагатай гэсэн тусдаа мөр энэ зааварт байхгүй. — [Unimatrix SMS API](https://www.unimtx.com/docs/api/send); [Unimatrix get started](https://www.unimtx.com/docs/get-started)
- Messaggio, EUR, «estimate»: G-MOBILE €0.22167, MOBICOM €0.27500, SKYTEL €0.33667, UNITEL €0.38167. Яг үнэ дансны менежерээр. Хуудасны доод «SMS from €0.00500» нь Монголын үнэ биш, ерөнхий эхлэх үнэ. — [Messaggio SMS Gateway Mongolia](https://messaggio.com/sms-gateway-api/mongolia/); [Messaggio SMS pricing Mongolia](https://messaggio.com/sms-pricing/mongolia/)
- Cheap Global SMS: MobiCom $0.314, Unitel $0.39, GMobile $0.392, Skytel $0.392 (1 SMS = тухайн кредит). — [Cheap Global SMS Mongolia](https://cheapglobalsms.com/bulk-sms-to/MN/mongolia)
- Infobip үнэ: улс, сүлжээгээр өөр, дундаж үнийг тооцоолуур харуулна, сүлжээ тус бүрийн үнэ Portal дотор. Татаж үзсэн нээлттэй хуудаснаас Монголын USD/сегмент тоо гараагүй. — [Infobip SMS pricing](https://www.infobip.com/sms/pricing)
- Infobip Монгол sender: үсэг-тоон болон урт тоон дэмжинэ, бүртгэл шаардлагагүй, short code үгүй, хоёр тал үгүй. — [Infobip SMS coverage and connectivity](https://www.infobip.com/docs/sms/sms-coverage-and-connectivity)
- Vonage: нийтийн үнийн хуудас улсын жагсаалт гаргаагүй («Oops. something isn't right» гэсэн хайлтын товч). Дансны үнийг Dashboard → Billing → Pricing → CSV таталтаар, эсвэл нэвтрэлт шаардсан Pricing API-аар авна. CSV-д Price (EUR)/message гэж бичсэн. Монголын тоо энэ судалгаанд нээлттэй гараагүй. — [Vonage SMS pricing](https://www.vonage.com/communications-apis/sms/pricing/); [Vonage dashboard pricing](https://developer.vonage.com/en/dashboard/control/pricing)
- Vonage sender: үсэг-тоон болон тоон дэмжинэ, ерөнхий нэр (INFO, SMS, NOTICE) хориглоно. Бүртгэлийн хугацаа, бүртгэл шаардлагатай эсэхийг 2023 оны нийтлэлд бичээгүй. — [Vonage Mongolia SMS Features](https://api.support.vonage.com/hc/en-us/articles/218931478-Mongolia-SMS-Features-and-Restrictions)
- SMS.to Монгол хуудсыг бүтнээр татахад сегментийн USD тоо гарсангүй. «Pricing for Mongolia is per message and shown on our SMS pricing page» гэжээ. Үнийн ерөнхий хуудас «Download prices for all countries» руу чиглүүлж, Монголын тоог шууд харуулаагүй. Хайлтын товчлолд тус хуудасны тооцоолуур дээр 0.023 гэж харагдсан боловч бүтэн таталт тэр тоог Монголын үнэ гэж баталгаажуулаагүй. SMS.to-ийн 2026 оны 9-р сарын харьцуулалтад «From $0.023 per SMS, varies by country» болон «$0.023 is its starting price across all destinations» гэж бичсэн. — [SMS.to Mongolia](https://sms.to/bulk/mongolia/); [SMS.to pricing](https://sms.to/pricing/); [SMS.to provider comparison, 2026-09](https://sms.to/blog/top-7-best-sms-api-providers-full-comparison-guide/)
- LINK Mobility, 2026-04-30: Монголд sender бүртгэл шаардлагагүй, боломжгүй («not necessary or feasible»). Дөрвөн операторт тоон, үсэг-тоон, short code Yes. — [LINK Mobility Mongolia sender ID](https://docs.linkmobility.com/regulatory-guidelines/sender-id/mongolia)
- Telnyx-ийн нээлттэй «$0.004 per message part» нь АНУ-ын local үнэ. Энэ хайлтаас Монголын үнэ гараагүй. — [Telnyx messaging pricing](https://telnyx.com/pricing/messaging/)

### Inferences
- Нээлттэй USD үнээр, операторын задаргаатай хамгийн бага нь Unimatrix-ийн $0.1986. Үүний дараа Bird pay-as-you-go $0.26 (үсэг-тоон, сегмент), Plivo-ийн хамгийн бага сүлжээ $0.2800 (G-Mobile), Twilio $0.3541 (сегмент, бүх сүлжээнд нэг үнэ).
- Messaggio-ийн €0.22167–€0.38167-г USD руу хөрвүүлээгүй. Хуудас өөрөө estimate гэсэн тул хамгийн хямд USD сонголтод оруулаагүй.
- Bird-ийн $0.2121 (MTC) ба $0.26 (pay-as-you-go) нь өөр бүтээгдэхүүн. MTC дээр carrier fee нэмэгдэнэ гэж тусад нь бичсэн тул $0.2121-ийг эцсийн үнэ гэж үзэхгүй.
- Үсэг-тоон нэр Монголд бүртгэлгүй ажиллана гэсэн дүгнэлт Twilio, Infobip, Bird, LINK Mobility дээр давхардсан. Vonage ерөнхий нэрийг хориглодог тул «SMS», «INFO» гэх мэт нэр ашиглахгүй.
- Кирилл монгол текст UCS-2 руу ордог (Twilio үсэг-тоон дээр UCS-2 Supported гэж бичсэн). Twilio болон Bird сегментээр тооцдог тул урт кирилл мессеж нэг үнээр биш, хэд хэдэн сегментээр үржинэ. Нэг сегментийн тэмдэгтийн тоог эдгээр Монгол хуудсанд тоогоор бичээгүй.

### Gaps
- Infobip, Vonage: Монголын нийтийн USD (эсвэл EUR) үнэ login/portal/API-ийн цаана. Нээлттэй хуудас харуулаагүй.
- SMS.to: Монголын бодит үнэ татсан хуудсанд байхгүй. Хайлтын 0.023-ыг Монголын үнэ гэж бүртгээгүй.
- Twilio «additional carrier fees may apply» гэсэн боловч татсан Монгол үнийн хуудсанд тусдаа carrier fee-ийн мөнгөн дүн байгаагүй. Bird мөн carrier fee тусдаа гэсэн ч Монголын дүн байхгүй.
- Plivo «/sms» гэж бичсэн. Энэ нь Twilio/Bird-ийн «per segment»-тэй ижил эсэхийг хуудас хэлээгүй.
- ClickSend-ийн Монгол үнэ dashboard/тооцоолуурын цаана. Нээлттэй тоо олдсонгүй.

## Жижиг Монгол аппад гарах сул тал: хүргэлт, дотоод sender, урьдчилгаа, олон улсын дугаар

### Takeaway
Олон улсын гарцын нээлттэй үнэ нэг мессеждээ центийн араас хойшхи долларын хэмжээтэй ($0.20–$0.35). Дотоод Мобикомын 6 оронтой тусгай дугаараас илгээх тариф 45₮ (НӨАТ орсон). Үсэг-тоон sender хадгалагдвал хэрэглэгч гадаад дугаар биш, аппын нэрийг харж болно. Тоон олон улсын дугаар G-Mobile, Mobicom дээр Twilio-д хаагдсан. Хоёр талын хариу ерөнхийдөө байхгүй. Хүргэлтийн хувийн нийтлэгдсэн хэмжилт олдсонгүй. Олон улсын данс ихэвчлэн урьдчилсан кредит, дотоод тусгай дугаар нь дугаарын анхны төлбөр шаардана.

### Cited Findings
- Хоёр тал байхгүй: Twilio «Two-way SMS supported: No». Infobip Монгол «2-way SMS supported: No». Bird «Two-way messaging: no», үсэг-тоон нь «one-way». Хэрэглэгч мессеж рүү хариу бичиж апп руу буцааж чадахгүй. — [Twilio guidelines](https://www.twilio.com/en-us/guidelines/mn/sms); [Infobip coverage](https://www.infobip.com/docs/sms/sms-coverage-and-connectivity); [Bird Mongolia](https://bird.com/sms-api/features/destinations/mongolia)
- Олон улсын дугаар харагдах эсэх: Twilio үсэг-тоон sender «Sender ID preserved: Yes». Олон улсын урт дугаар дэмжигддэг сүлжээнд мөн preserved = Yes, өөрөөр хэлбэл илгээсэн дугаар хадгалагдана. Гэхдээ G-Mobile, Mobicom дээр олон улсын урт дугаар дэмжигдэхгүй тул тэнд үсэг-тоон нэр ашиглана. — [Twilio Mongolia SMS Guidelines](https://www.twilio.com/en-us/guidelines/mn/sms)
- Bird: «The submitted sender ID is preserved», бүртгэлгүй, нэг тал. — [Bird SMS to Mongolia](https://bird.com/sms-api/features/destinations/mongolia)
- Infobip: Монголд дотоод ба олон улсын үсэг-тоон аль аль нь дэмжигдэнэ, бүртгэлгүй. Дотоод/олон улсын урсгалыг тусад нь ангилахгүй гэж тэмдэглэсэн. — [Infobip SMS coverage](https://www.infobip.com/docs/sms/sms-coverage-and-connectivity)
- Vonage: тоон sender дэмжинэ (тийм бол гадаад дугаар хадгалагдаж болно), үсэг-тоон дэмжинэ, ерөнхий нэр хориглоно. Маркетингэд opt-in хэрэгтэй. P2P хориглоно. — [Vonage Mongolia](https://api.support.vonage.com/hc/en-us/articles/218931478-Mongolia-SMS-Features-and-Restrictions)
- LINK Mobility операторын чадвар: дөрвөн операторт тоон, үсэг-тоон, short code Yes, бүртгэл шаардлагагүй. Энэ нь Twilio-ийн «short code Not Supported», «олон улсын урт дугаар G-Mobile/Mobicom дээр Not Supported»-той зөрж байна. Эхнийх нь операторын чадвар, хоёр дахь нь Twilio-ийн санал болгож буй маршрут. — [LINK Mobility Mongolia](https://docs.linkmobility.com/regulatory-guidelines/sender-id/mongolia); [Twilio guidelines](https://www.twilio.com/en-us/guidelines/mn/sms)
- Дотоод Мобиком тусгай дугаар: аж ахуйн нэгжид 6 оронтой (13xxxx, 14xxxx, 15xxxx) мессеж илгээх, хүлээн авах дугаар. Дугаарын үнэ: энгийн 99,000₮, хүрэл 220,000₮, мөнгөн 330,000₮, алтан 550,000₮. Тусгай дугаараас мессеж илгээх: дараа төлбөрт 45₮, урьдчилсан төлбөрт 45₮, НӨАТ багтсан. — [Мобиком тусгай дугаар](https://support.mobicom.mn/mon/sms-based/tusgai-dugaar)
- Скайтелийн Web2Sms тест хуудас: мессеж маркетингийн хүснэгтэд Скайтел сүлжээ, 1 мессеж, урьдчилсан төлбөрт 1,000–5,000 хэрэглэгч 22₮, 5,001–30,000 нь 16.5₮, 30,001-ээс дээш 11₮. VIP 55₮. Дуут мессеж (voice SMS) нь өөр тариф (жишээ нь 1,000–5,000 урьдчилсан 200₮) бөгөөд гэрээ байгуулах үед 100,000₮ урьдчилгаа гэж бичсэн. Хуудасны хаяг `testWeb2SmsService.html`. — [Skytel Web2Sms](http://web2sms.skytel.mn/testWeb2SmsService.html)
- Мобиком KAOS хэрэглэгчийн задгай тариф: мессеж 40₮, сүлжээ харгалзахгүй. Энэ нь хэрэглэгчийн SIM тариф, A2P API биш. — [Мобиком KAOS](https://support.mobicom.mn/mon/kaos)
- Урьдчилгаа / кредит: Twilio үнэ «pay-as-you-go», эхлүүлэхэд карт шаардахгүй гэсэн мөр. Үсэг-тоон sender сарын түрээсгүй. Олон улсын дугаар сард $1.15-аас. — [Twilio pricing MN](https://www.twilio.com/en-us/sms/pricing/mn)
- Infobip: үнэгүй данс, туршилтын кредит дуустал. Туршилтад 5 баталгаажсан дугаар руу 100 үнэгүй SMS, анхдагч тест sender ServiceSMS. Төлбөртэй болгосны дараа дугаар худалдаж авна. — [Infobip SMS docs](https://www.infobip.com/docs/sms)
- SMS.to: бүртгэл үнэгүй, API түлхүүр, эхний кампанит ажлын өмнө sender ID болон бүртгэлийг баг хамт хянана гэж Монгол хуудаст бичсэн. Кипр дэх Intergo Telecom Ltd. Гэрээгүй, ашигласнаар төлнө гэсэн ерөнхий үнэ. — [SMS.to Mongolia](https://sms.to/bulk/mongolia/); [SMS.to pricing](https://sms.to/pricing/)
- ClickSend: үнэ цэнэглэлтийн шатлалаар (илүү их цэнэглэлт, бага нэгж үнэ), урьдчилж кредит авах загвар. Монголын нэгж үнэ dashboard дээр. — [ClickSend pricing help](https://help.clicksend.com/en/articles/44198-understanding-how-pricing-works)
- SMSMeteor Монгол $0.0544/сегмент гэж нийтэлсэн, «No KYC», крипто төлбөр, чимээгүй цаг 09:00–21:00 орон нутгийн цаг. Оператор тус бүрийн үнэ байхгүй. «Elsewhere from $0.1170» гэсэн харьцуулалтын эх сурвалж хуудсан дээр нэрлэгдээгүй. — [SMSMeteor Mongolia](https://smsmeteor.com/coverage/mn)

### Inferences
- Жижиг аппын OTP-д үсэг-тоон нэр (жишээ нь аппын нэр) нь гадаад +1/+44 дугаараас илүү тохиромжтой. Twilio G-Mobile, Mobicom дээр өөр зам үлдээгээгүй. Нэр хадгалагдвал хэрэглэгч олон улсын дугаар биш, текст нэрийг харна. Энэ нь дотоодын 6 оронтой богино дугаартай ижил биш: хариу хүлээн авах, лавлах урсгал байхгүй.
- Үнийн зөрүү практик дээр том. Мобикомын тусгай дугаараас 45₮. Олон улсын нээлттэй үнэ $0.1986–$0.3541. 2026-10-14-ний албан ханшийг татаагүй тул хэд дахин хямд гэсэн тоог зохиогоогүй. Төгрөгийн тариф центийн дараалалтай, олон улсын үнэ хэдэн арван цент гэдэг нь ханш харахгүйгээр харагдана.
- Дотоод sender авахын сул тал нь дугаарын анхны төлбөр (Мобиком хамгийн багадаа 99,000₮) болон оператортой гэрээ. Олон улсын үсэг-тоон зам бүртгэлгүй гэж бичигдсэн тул жижиг апп эхлэхэд хурдан, гэхдээ мессеж бүр үнэтэй.
- Хүргэлт муу байж болзошгүйг баримт биш, хоосон зай гэж үзнэ. Нээлттэй хуудас амжилтын хувь нийтлээгүй.

### Gaps
- Аль ч гарцын Монгол руу чиглэсэн хүргэлтийн хувь, саатлын хэмжилт, «олон улсын дугаар гэж шүүгддэг» гэсэн операторын дүрэм олдсонгүй.
- Юнител, Жи-Мобайлын бизнес SMS API-ийн нийтийн төгрөг үнэ энэ хайлтад гарсангүй. Скайтелийн 11₮–22₮ нь тест хуудасны маркетингийн хүснэгт бөгөөд 2026 оны хүчинтэй тариф мөн эсэхийг баталгаажуулаагүй. Зөвхөн Скайтел багана дээр бичигдсэн.
- 45₮ болон $0.20–$0.35-ыг нэг валютад харьцуулсан албан ханш татаагүй.
- Дотоод 6 оронтой дугаар бүх сүлжээнд (Unitel, Skytel, G-Mobile) 45₮-өөр хүрдэг гэсэн Мобикомын хуудсан дээрх баталгаа байхгүй. Хуудас илгээх тарифыг нэг мөрөөр бичсэн.
- SMS.to Монголд sender-ийг «баг хянана» гэсэн нь бүртгэл шаардлагатай гэсэн үг үү, эсвэл зөвлөгөө үү гэдэг нь тодорхойгүй.

## Хамгийн хямд, үнэ нь нийтлэгдсэн итгэлтэй сонголт

### Takeaway
Нээлттэй USD үнэтэй, дөрвөн операторыг нэрлэсэн, баримт бичигтэй гарцуудаас хамгийн бага нь Unimatrix: $0.1986/мессеж, Mobicom, Unitel, Skytel, G-Mobile, бусад бүгдэд transactional болон promotional адилхан. SMSMeteor $0.0544 гэж нийтэлсэн боловч KYC-гүй, крипто, операторын задаргаагүй тул итгэлтэй хамгийн хямд гэж аваагүй. SMS.to-ийн $0.023 нь бүх чиглэлийн эхлэх үнэ бөгөөд Монголын үнэ биш.

### Cited Findings
- Unimatrix Mongolia: US$ 0.1986 per message. Mobicom 42899, Unitel 42888, Skytel 42800, G-Mobile 42898, Others бүгд $0.1986 / $0.1986. — [Unimatrix Mongolia SMS](https://www.unimtx.com/sms/mn)
- Харьцуулахад илүү өндөр нээлттэй үнэ: Bird alphanumeric $0.26/сегмент. Plivo $0.2800–$0.3500/sms. Twilio $0.3541/сегмент. Cheap Global SMS $0.314–$0.392. — [Bird pricing MN](https://bird.com/en-us/products/sms/pricing/mn); [Plivo MN](https://www.plivo.com/sms/pricing/mn/); [Twilio MN](https://www.twilio.com/en-us/sms/pricing/mn); [Cheap Global SMS](https://cheapglobalsms.com/bulk-sms-to/MN/mongolia)
- SMSMeteor: «$0.0544 per message, no KYC», «Paid in crypto, no identity checks», 160 тэмдэгтийн сегмент, суулгах төлбөргүй, кредит хугацаагүй гэж бичсэн. — [SMSMeteor Mongolia](https://smsmeteor.com/coverage/mn)
- SMS.to 2026-09 нийтлэл: $0.023 нь бүх чиглэлийн эхлэх үнэ, улс бүрээр өөр. — [SMS.to comparison](https://sms.to/blog/top-7-best-sms-api-providers-full-comparison-guide/)

### Inferences
- Жижиг апп олон улсын гарцаар OTP илгээх бол нийтлэгдсэн үнээр Unimatrix Twilio-оос ойролцоогоор 44% хямд ($0.1986 ба $0.3541). Энэ нь хүргэлтийн чанар ижил гэсэн үг биш. Хүргэлтийн хувь нийтлэгдээгүй.
- $0.0544-ийг «хамгийн хямд итгэлтэй» гэж авахгүй. Үнэ нийтлэгдсэн ч оператор, sender бүртгэл, амжилттай хүргэлтийн баримт байхгүй, KYC-гүй крипто төлбөр нь аппын бодит дугаар руу OTP хүргэх найдвартай байдлыг нээлттэй эх сурвалжаар батлахгүй.

### Gaps
- Unimatrix-ийн $0.1986 сегмент үү, мессеж үү гэдгийг хуудас «per message» гэж бичсэн. Кирилл олон сегментэд хэрхэн үржихийг Монгол хуудас заагаагүй.
- Unimatrix-ийн Монгол хүргэлтийн бодит хувь, аль маршрут (шууд оператор эсвэл олон улсын транзит) ашигладгийг нээлттэй хуудас хэлээгүй.
- Infobip Portal эсвэл Vonage CSV дотор $0.1986-аас бага үнэ байж болно. Нээлттэй биш тул хамгийн хямд жагсаалтад оруулаагүй.

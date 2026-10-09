import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const raw = process.env.FIREBASE_SERVICE_ACCOUNT_B64
  ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8")
  : process.env.FIREBASE_SERVICE_ACCOUNT;
const serviceAccount = JSON.parse(raw);
if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();

const films = [
  { id: "nuuts-gerelt", title: "Нууц гэрлэлт", genre: "Романтик", episodes: 48, price: 4900, access: "paid", image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=700&q=85", views: 128000, status: "Нийтлэгдсэн", featured: true, description: "Амьдралын гэнэтийн эргэлт, нууцлаг учрал хоёр хүний хувь тавиланг холбож, хайр ба итгэлийн үнэ цэнийг шинээр нээнэ." },
  { id: "zurhnii-or", title: "Зүрхний өр", genre: "Драма", episodes: 36, price: 0, access: "free", image: "https://images.unsplash.com/photo-1768398222507-9f551fa0e9e8?auto=format&fit=crop&w=700&q=85", views: 97000, status: "Нийтлэгдсэн", featured: false, description: "Өнгөрсөн алдаа, өнөөдрийн сонголт хоёр нэгэн гэр бүлийг дахин ойртуулна." },
  { id: "dargyn-nuuts", title: "Даргын нууц", genre: "Романтик", episodes: 60, price: 5900, access: "paid", image: "https://images.unsplash.com/photo-1600481176431-47ad2ab2745d?auto=format&fit=crop&w=700&q=85", views: 83000, status: "Нийтлэгдсэн", featured: false, description: "Хүчтэй хүний нууц, зөөлөн зүрх хоёр нэг оффист мөргөлдөнө." },
  { id: "hoyor-dahi", title: "Хоёр дахь амьдрал", genre: "Уран зөгнөлт", episodes: 52, price: 6900, access: "paid", image: "https://images.unsplash.com/photo-1557656285-ecf52767dbb9?auto=format&fit=crop&w=700&q=85", views: 61000, status: "Ноорог", featured: false, description: "Хоёр дахь боломж өгөгдөхөд хүн өмнөх алдаагаа засах уу." },
  { id: "zunii-boroo", title: "Зуны бороо", genre: "Драма", episodes: 42, price: 0, access: "free", image: "https://images.unsplash.com/photo-1626775550407-c09be28b6053?auto=format&fit=crop&w=700&q=85", views: 55000, status: "Нийтлэгдсэн", featured: false, description: "Нэг зуны бороо хуучин найзуудыг дахин нэг дор авчирна." },
  { id: "cham-ruu", title: "Чам руу буцах зам", genre: "Өшөө авалт", episodes: 40, price: 4900, access: "paid", image: "https://images.unsplash.com/photo-1624091844772-554661d10173?auto=format&fit=crop&w=700&q=85", views: 42000, status: "Нийтлэгдсэн", featured: false, description: "Алдагдсан итгэлийг буцааж авах зам ойрхон мөртлөө аюултай." },
];

for (const film of films) {
  await db.collection("series").doc(film.id).set({ ...film, year: 2025, age: "13+", createdAt: Date.now() }, { merge: true });
}

await db.collection("settings").doc("app").set({
  name: "CinemaFeel",
  email: "support@cinemafeel.mn",
  price: "14900",
  maintenance: false,
  registration: true,
  notifications: true,
}, { merge: true });

console.log("Seeded", films.length, "series");

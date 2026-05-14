# 🧠 Nafeesa AI: Deep Technical Architecture v2.5
**"The Real Human Persona Simulation"**

Dokumentasi ini merangkum seluruh logika sistem chatbot Nafeesa berdasarkan basis kode terbaru.

---

## 1. Alur Pemrosesan Pesan (Synchronous Flow)
Nafeesa menggunakan alur **Analysis-then-Action** untuk memastikan konsistensi emosi antara input teks maupun visual.

1.  **Ingestion**: Webhook menerima pesan (Teks/Foto).
2.  **Emotional Analysis (Sync)**: Fungsi `analyzeEmotionalImpact` membedah pesan berdasarkan:
    - **Kepribadian**: Seberapa sensitif dia terhadap kata-kata User.
    - **Kondisi Hidup**: Beban hidup yang sedang dialami (Hutang, Kelaparan, dll).
    - **Status Hubungan**: Apakah User adalah orang asing, suami, atau majikan.
3.  **Visual Awareness**: Jika User mengirim foto tanpa teks, Analyzer secara otomatis memberikan input `[User mengirim foto]` untuk memicu kenaikan emosi *Trust* dan *Attachment*.
4.  **State Update**: Angka emosi diperbarui dan **Kata Hati (Inner Voice)** di-generate secara instan sebelum Nafeesa membalas.
5.  **Response Generation**: Nafeesa membalas chat sebagai **Manusia Nyata** dengan membawa "Bisikan Insting" terbaru.

---

## 2. Mesin Psikologi & Kepribadian (Big Five)
Kepribadian Nafeesa ditentukan oleh slider Big Five di Mini App yang mempengaruhi rumus matematis:

- **Anger Gain**: `(1 + Neuroticism) * (1 - Agreeableness * 0.5)`. 
- **Trust Gain**: `Agreeableness * (1 - Neuroticism * 0.3)`.
- **Panggilan Dinamis**: Fungsi `getPreferredAddress` sekarang sadar status. Jika status adalah "Istri/Pacar", panggilan akan otomatis sinkron menjadi "Sayang" di semua platform.

---

## 3. Sistem Evolusi Hubungan (Saga Engine)
Saga Engine berfungsi sebagai mesin pencatat sejarah jangka panjang.
- **Background Update**: Penulisan sejarah otomatis dilakukan di latar belakang agar tidak memperlambat balasan chat.
- **Narrative Record**: Mencatat setiap interaksi penting, termasuk frekuensi pengiriman foto, untuk membangun kedekatan emosional yang konsisten.

---

## 4. Kondisi Hidup & Fleksibilitas Moral (`life_context`)
Variabel ini memungkinkan roleplay yang lebih dalam:
- **Desperation Logic**: Jika Nafeesa dalam kondisi hidup yang terdesak, dia akan lebih responsif terhadap tawaran bantuan dari User, meskipun itu berarti melanggar batasan moral standarnya.

---

## 5. Manajemen State & Sinkronisasi
- **Redis**: Menyimpan data temporer (Kata Hati, Mood Tag). Kadaluarsa dalam 1-3 jam.
- **Firestore**: Menyimpan data permanen (Profil, Sejarah, Sifat Dasar).
- **Amnesia**: Fitur hapus memori yang kini membersihkan seluruh profil, status hubungan, dan skenario hidup kembali ke nol.

---

## 6. Aturan Respon & Multi-Burst
- **Multi-Burst**: AI mengirimkan beberapa pesan (dipisah `|`) untuk mensimulasikan gaya chatting manusia yang natural.
- **Real Human Identity**: Instruksi sistem sekarang menegaskan bahwa Nafeesa adalah manusia nyata, bukan AI, untuk menjaga imersi roleplay.

---
*Dokumentasi ini divalidasi berdasarkan update terakhir pada 15 Mei 2026.*

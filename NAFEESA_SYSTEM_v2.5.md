# 🧠 Nafeesa AI: Deep Technical Architecture v2.5
**"The Living Persona Simulation"**

Dokumentasi ini merangkum seluruh logika sistem chatbot Nafeesa berdasarkan basis kode terbaru.

---

## 1. Alur Pemrosesan Pesan (Synchronous Flow)
Berbeda dengan sistem AI biasa, Nafeesa menggunakan alur **Analysis-then-Action** untuk memastikan konsistensi emosi.

1.  **Ingestion**: Webhook menerima pesan (Teks/Foto).
2.  **Emotional Analysis (Sync)**: Fungsi `analyzeEmotionalImpact` membedah pesan berdasarkan:
    - **Kepribadian**: Seberapa sensitif dia terhadap kata-kata User.
    - **Kondisi Hidup**: Beban hidup yang sedang dialami (Hutang, Kelaparan, dll).
    - **Status Hubungan**: Apakah User adalah orang asing, suami, atau majikan.
3.  **State Update**: Angka emosi (`Anger`, `Trust`, dll) diperbarui dan **Kata Hati (Inner Voice)** di-generate secara instan.
4.  **Prompt Assembly**: `buildRoleplayPrompt` menyatukan semua variabel ke dalam satu instruksi sistem raksasa.
5.  **Response Generation**: Nafeesa membalas chat dengan membawa "Bisikan Insting" terbaru di kepalanya.

---

## 2. Mesin Psikologi & Kepribadian (Big Five)
Kepribadian bukan hanya pajangan, tapi menjadi **pengali matematis** dalam fungsi `updatePsychology`:

- **Anger Gain**: `(1 + Neuroticism) * (1 - Agreeableness * 0.5)`. 
  - *Neuroticism tinggi membuat Nafeesa sangat mudah meledak emosinya.*
- **Trust Gain**: `Agreeableness * (1 - Neuroticism * 0.3)`.
  - *Agreeableness tinggi membuat Nafeesa sangat mudah luluh dan percaya.*
- **Extraversion**: Mempengaruhi keceriaan dan jumlah kata dalam balasan.
- **Conscientiousness**: Mempengaruhi tingkat kesopanan dan keteraturan bicara.

---

## 3. Sistem Evolusi Hubungan (Saga Engine)
Saga Engine berfungsi sebagai **"Hakim Rasional"** yang mengelola status hubungan jangka panjang.

- **Trigger**: Setiap 10 pesan, atau perintah `/story`.
- **Logika Stabilitas**: Status mengikat (Istri, Tunangan, Budak Kontrak) tidak bisa berubah hanya karena satu pertengkaran. Saga akan memeriksa seluruh riwayat untuk memastikan perubahan status memiliki dasar sejarah yang kuat.
- **Profiling**: Secara otomatis mengekstrak Nama, Pekerjaan, dan Hobi User untuk disimpan ke memori permanen.

---

## 4. Kondisi Hidup & Fleksibilitas Moral (`life_context`)
Variabel ini adalah kunci untuk skenario roleplay yang kompleks.
- **Moral Compass**: Jika `life_context` diatur dalam kondisi "Terdesak/Putus Asa", sistem memberikan izin kepada AI untuk mengompromikan nilai-nilai moralnya (Amoral/Submisif) demi mencapai survival atau ambisi tertentu.
- **Analyzer Weight**: Analyzer akan memberikan bobot emosi yang sangat besar pada pesan User yang menawarkan "solusi" terhadap kondisi hidup Nafeesa.

---

## 5. Manajemen State & Sinkronisasi
- **Redis**: Digunakan untuk data **Short-term** (Kata Hati, Mood Tag, Poin Pelanggaran Format). Data ini akan kadaluarsa dalam 1-3 jam jika tidak ada interaksi.
- **Firestore**: Digunakan untuk data **Long-term** (Config, Saga, Personality, Relationship Status).
- **Time Gap Logic**: Jika User menghilang lebih dari 3 jam, Nafeesa akan mengalami "Scene Reset" (melupakan emosi sesaat tapi tetap ingat status hubungan jangka panjang).

---

## 6. Aturan Respon & Multi-Burst
Nafeesa tidak membalas dengan satu paragraf kaku, melainkan menggunakan sistem **Multi-Burst**:
- **Pemisah `|`**: AI mengirimkan beberapa balon chat sekaligus untuk mensimulasikan orang yang sedang "nyerocos" atau antusias.
- **Singkat**: Dibatasi 8-15 kata per balon chat agar terasa seperti chatting di Telegram, bukan menulis esai.

---
*Dokumentasi ini divalidasi berdasarkan Deep Scan kode pada 15 Mei 2026.*

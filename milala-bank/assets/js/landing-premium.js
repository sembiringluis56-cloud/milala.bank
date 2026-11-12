/* MILALA BANK | public landing enhancement.
 * No Firebase calls, no account access, no financial data writes.
 */
(() => {
  'use strict';

  const questions = [
    {
      group: 'Tentang MILALA',
      q: 'Apakah MILALA BANK merupakan bank sungguhan?',
      a: 'Bukan. MILALA BANK adalah simulasi pendidikan perbankan. Saldo, rekening, transaksi, dan kredit yang ditampilkan bersifat virtual dan tidak mewakili dana sungguhan.'
    },
    {
      group: 'Pendaftaran',
      q: 'Bagaimana cara membuat akun nasabah?',
      a: 'Pilih Buka Rekening, isi data pendaftaran simulasi, lalu verifikasi alamat email yang aktif. Setelah verifikasi dan proses pendaftaran berhasil, rekening virtual dapat ditampilkan pada portal nasabah.'
    },
    {
      group: 'Pendaftaran',
      q: 'Mengapa email saya sudah terverifikasi tetapi rekening belum muncul?',
      a: 'Verifikasi email dan pembuatan rekening merupakan dua proses berbeda. Periksa apakah proses pendaftaran sudah selesai. Jika muncul pesan email sudah terdaftar atau cabang tidak aktif, jangan membuat akun ganda; minta petugas demo memeriksa datanya.'
    },
    {
      group: 'Akun & keamanan',
      q: 'Saya lupa kata sandi. Apa yang harus dilakukan?',
      a: 'Gunakan tautan Lupa password pada halaman login dan ikuti petunjuk yang dikirim ke alamat email aktif. Jika akun demo memakai alamat email fiktif, hubungi pengelola simulasi untuk bantuan pemulihan; jangan membagikan kata sandi atau OTP.'
    },
    {
      group: 'Fitur layanan',
      q: 'Bisakah saya mentransfer atau menarik uang sungguhan?',
      a: 'Tidak. Seluruh fitur transaksi pada MILALA BANK hanya digunakan untuk latihan dan tidak terhubung ke jaringan pembayaran atau rekening bank sebenarnya.'
    },
    {
      group: 'Fitur layanan',
      q: 'Apa yang bisa dilakukan melalui portal nasabah?',
      a: 'Pengguna demo dapat meninjau informasi rekening virtual, riwayat transaksi simulasi, dan status pengajuan kredit latihan sesuai fitur yang tersedia pada sistem.'
    },
    {
      group: 'Keamanan',
      q: 'Apakah saya boleh memasukkan NIK, PIN, atau data perbankan asli?',
      a: 'Jangan. Karena ini simulasi pendidikan, gunakan data latihan yang tidak sensitif. Jangan memasukkan NIK, nomor kartu, PIN, OTP, atau informasi rekening nyata.'
    },
    {
      group: 'Masukan',
      q: 'Bagaimana cara mengirim saran untuk pengembangan MILALA BANK?',
      a: 'Isi formulir feedback di bawah. Kamu dapat membagikan masukan lewat aplikasi pilihanmu atau menyalinnya untuk dikirim kepada pengelola. Form ini tidak mengirim data langsung ke server MILALA BANK.'
    }
  ];

  const esc = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const faqHTML = questions.map((item, i) => `
    <details class="ml-faq-item" data-qa="${esc((item.q + ' ' + item.a + ' ' + item.group).toLocaleLowerCase('id-ID'))}">
      <summary><span class="ml-faq-index">${String(i + 1).padStart(2, '0')}</span><span class="ml-faq-q">${esc(item.q)}</span><span class="ml-faq-plus" aria-hidden="true">+</span></summary>
      <div class="ml-faq-answer"><span class="ml-category">${esc(item.group)}</span><p>${esc(item.a)}</p></div>
    </details>`).join('');

  const markup = `
    <section class="ml-belt" aria-label="Kelebihan MILALA">
      <div><span class="ml-belt-icon" aria-hidden="true">✧</span><span><strong>Dirancang untuk belajar</strong><small>Simulasi perbankan digital</small></span></div>
      <div><span class="ml-belt-icon" aria-hidden="true">◈</span><span><strong>Mudah dipahami</strong><small>Pengalaman yang sederhana</small></span></div>
      <div><span class="ml-belt-icon" aria-hidden="true">◎</span><span><strong>Tidak memakai uang nyata</strong><small>Latihan tanpa transaksi riil</small></span></div>
    </section>
    <section class="ml-help" id="faq" aria-labelledby="ml-faq-title">
      <div class="ml-help-head"><div><span class="ml-overline">PUSAT INFORMASI</span><h2 id="ml-faq-title">Ada pertanyaan?<br><em>Temukan jawabannya.</em></h2></div><p>Informasi yang paling sering dicari tentang akun, verifikasi email, fitur simulasi, dan keamanan.</p></div>
      <div class="ml-help-layout"><div class="ml-help-side"><div class="ml-info-card"><span class="ml-info-symbol" aria-hidden="true">?</span><h3>FAQ — Pertanyaan Umum</h3><p>Jawaban singkat dan praktis tanpa harus menunggu bantuan.</p><div class="ml-mini-rule"></div><p class="ml-mini-note">Untuk masalah akun pribadi, jangan membagikan password, OTP, NIK, atau informasi keuangan sungguhan.</p></div></div>
      <div class="ml-help-questions"><label class="ml-search-label" for="ml-faq-search">Cari pertanyaan</label><div class="ml-search"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg><input id="ml-faq-search" type="search" placeholder="Contoh: verifikasi email, lupa password..." autocomplete="off" maxlength="80"></div><div id="ml-faq-list">${faqHTML}</div><p id="ml-faq-empty" class="ml-faq-empty" hidden>Tidak ada pertanyaan yang cocok. Coba kata kunci lain atau tulis masukan di bawah.</p></div></div>
    </section>
    <section class="ml-feedback" id="feedback" aria-labelledby="ml-feedback-title"><div class="ml-feedback-lead"><span class="ml-overline">SUARA PENGGUNA</span><h2 id="ml-feedback-title">Punya ide untuk<br><em>MILALA berikutnya?</em></h2><p>Setiap saran bisa membantu menjadikan simulasi keuangan ini lebih jelas dan bermanfaat bagi masyarakat.</p><div class="ml-feedback-privacy"><span aria-hidden="true">◈</span> Tanpa login tambahan, tanpa data rekening, tanpa pelacakan.</div></div><form class="ml-feedback-form" id="ml-feedback-form" novalidate><div class="ml-field"><label for="ml-feedback-category">Jenis masukan</label><select id="ml-feedback-category" name="category" required><option value="Saran fitur">Saran fitur</option><option value="Tampilan dan kemudahan">Tampilan dan kemudahan</option><option value="Bug atau kendala">Bug atau kendala</option><option value="Edukasi keuangan">Edukasi keuangan</option><option value="Lainnya">Lainnya</option></select></div><fieldset class="ml-rating"><legend>Penilaian pengalaman <span>(opsional)</span></legend><div class="ml-rating-options">${[1,2,3,4,5].map(n => `<label><input type="radio" name="rating" value="${n}"><span>${n} ★</span></label>`).join('')}</div></fieldset><div class="ml-field"><label for="ml-feedback-message">Pesan atau ide kamu</label><textarea id="ml-feedback-message" name="message" rows="4" minlength="15" maxlength="1000" required placeholder="Ceritakan fitur yang kamu butuhkan atau pengalaman yang bisa diperbaiki..."></textarea><small><span id="ml-feedback-count">0</span>/1000 karakter · Hindari data pribadi.</small></div><div class="ml-feedback-actions"><button class="ml-send" type="submit">Bagikan masukan <span aria-hidden="true">↗</span></button><button class="ml-copy" id="ml-copy-feedback" type="button">Salin teks</button></div><p class="ml-feedback-disclosure">Masukan <strong>tidak dikirim otomatis ke server</strong>. Tombol Bagikan membuka aplikasi berbagi di perangkat yang mendukung; jika tidak tersedia, teks disalin agar dapat kamu kirim sendiri.</p><p id="ml-feedback-status" class="ml-feedback-status" role="status" aria-live="polite"></p></form></section>
  `;

  function compose(form) {
    const data = new FormData(form);
    const category = String(data.get('category') || 'Lainnya');
    const message = String(data.get('message') || '').trim();
    const rating = String(data.get('rating') || 'Tidak diisi');
    return `MASUKAN MILALA BANK (SIMULASI EDUKASI)\nKategori: ${category}\nPenilaian: ${rating}\n\n${message}\n\nDibuat dari halaman MILALA BANK. Tidak mengandung data akun.`;
  }
  function status(text, ok = true) {
    const el = document.getElementById('ml-feedback-status');
    if (!el) return;
    el.textContent = text;
    el.classList.toggle('ml-error', !ok);
  }
  function validateMessage(form) {
    const input = form.querySelector('#ml-feedback-message');
    if (!input) return false;
    input.value = input.value.trim();
    if (!input.value || input.value.length < 15) {
      status('Tulis masukan minimal 15 karakter tanpa informasi sensitif.', false);
      input.focus();
      return false;
    }
    return true;
  }
  async function copyFeedback(form) {
    const text = compose(form);
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); status('Masukan disalin. Tempel dan kirim melalui saluran pilihanmu.'); return; } catch (_) { /* fallback */ }
    }
    const input = form.querySelector('#ml-feedback-message');
    if (input) { input.focus(); input.select(); }
    status('Penyalinan otomatis tidak tersedia. Salin isi pesan yang sudah dipilih lalu kirim lewat aplikasi pilihanmu.', false);
  }

  function attach() {
    const home = document.querySelector('#app > .public-header + main.public-home') || document.querySelector('#app main.public-home');
    if (!home || home.querySelector('#faq')) return;
    home.classList.add('ml-premium-home');
    document.querySelector('#app .public-header')?.classList.add('ml-premium-header');
    const endSection = home.querySelector('.public-about');
    if (!endSection) return;
    endSection.insertAdjacentHTML('beforebegin', markup);

    const nav = document.querySelector('#app .public-header .public-nav');
    if (nav && !nav.querySelector('a[href="#faq"]')) {
      nav.insertAdjacentHTML('beforeend', '<a href="#faq">FAQ</a><a href="#feedback">Feedback</a>');
    }
    const heroButtons = home.querySelector('.hero-buttons');
    if (heroButtons && !heroButtons.querySelector('a[href="#faq"]')) {
      heroButtons.insertAdjacentHTML('beforeend', '<a class="ml-hero-help" href="#faq">Pelajari dulu <span aria-hidden="true">↗</span></a>');
    }

    const search = document.getElementById('ml-faq-search');
    const list = document.getElementById('ml-faq-list');
    const empty = document.getElementById('ml-faq-empty');
    search?.addEventListener('input', () => {
      const query = search.value.trim().toLocaleLowerCase('id-ID');
      let visible = 0;
      list?.querySelectorAll('.ml-faq-item').forEach(item => {
        const yes = item.dataset.qa.includes(query);
        item.hidden = !yes;
        if (yes) visible++;
      });
      if (empty) empty.hidden = visible > 0;
    });

    const form = document.getElementById('ml-feedback-form');
    const message = document.getElementById('ml-feedback-message');
    const count = document.getElementById('ml-feedback-count');
    message?.addEventListener('input', () => { if (count) count.textContent = String(message.value.length); });
    form?.addEventListener('submit', async event => {
      event.preventDefault();
      if (!validateMessage(form)) return;
      const text = compose(form);
      if (navigator.share) {
        try {
          await navigator.share({ title: 'Masukan MILALA BANK', text });
          status('Aplikasi berbagi sudah dibuka. Pastikan kamu memilih penerima dan menyelesaikan pengiriman.');
          return;
        } catch (error) {
          if (error?.name === 'AbortError') { status('Berbagi dibatalkan. Masukan belum dikirim.'); return; }
        }
      }
      await copyFeedback(form);
    });
    document.getElementById('ml-copy-feedback')?.addEventListener('click', async () => {
      if (!validateMessage(form)) return;
      await copyFeedback(form);
    });
  }

  function boot() {
    const app = document.getElementById('app');
    if (!app) return;
    attach();
    const observer = new MutationObserver(() => {
      if (document.querySelector('#app main.public-home')) attach();
    });
    observer.observe(app, {childList: true});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();

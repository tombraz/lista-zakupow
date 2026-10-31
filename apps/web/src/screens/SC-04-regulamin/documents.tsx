// Szkic treści do akceptacji właściciela (T-004, AC8). Polityka musi opisywać co najmniej:
// zakres danych, kto je widzi, brak zewnętrznej analityki, usunięcie konta, kopie 7 dni.

export function TermsOfService() {
  return (
    <>
      <h3>Czym jest aplikacja</h3>
      <p>
        Wspólna lista zakupów to bezpłatna aplikacja do prowadzenia list zakupów i dzielenia się
        nimi z domownikami. Działa w ramach niekomercyjnego pilotażu.
      </p>
      <h3>Konto</h3>
      <p>
        Konto może założyć osoba, która ukończyła 16 lat. Jedno konto należy do jednej osoby. Nie
        udostępniaj nikomu swojego hasła.
      </p>
      <h3>Wspólne listy</h3>
      <p>
        Właściciel listy może zaprosić inne osoby jednorazowym linkiem ważnym 7 dni. Uczestnicy
        widzą i zmieniają pozycje listy, a właściciel może ich z niej usunąć.
      </p>
      <h3>Zasady korzystania</h3>
      <p>
        Nie używaj aplikacji do treści niezgodnych z prawem ani do zapychania jej danymi. Obowiązują
        limity: 50 list na osobę, 500 pozycji na liście i 20 uczestników listy.
      </p>
      <h3>Dostępność usługi</h3>
      <p>
        W czasie pilotażu nie gwarantujemy ciągłego działania aplikacji. Możemy ją zmienić lub
        zakończyć, uprzedzając o tym w aplikacji.
      </p>
      <h3>Wersja</h3>
      <p>Regulamin obowiązuje od 27 października 2026 r.</p>
    </>
  );
}

export function PrivacyPolicy() {
  return (
    <>
      <h3>Jakie dane zbieramy</h3>
      <p>
        Twoje imię, adres e-mail i hasło (zapisane wyłącznie jako skrót, którego nie da się
        odczytać), treść list i pozycji, informację, kto dodał i kto odhaczył pozycję, datę
        akceptacji regulaminu i potwierdzenia wieku oraz dane sesji potrzebne do utrzymania
        zalogowania (adres IP i rodzaj przeglądarki).
      </p>
      <h3>Po co</h3>
      <p>Tylko do działania aplikacji: logowania, wspólnych list i ochrony przed nadużyciami.</p>
      <h3>Kto widzi Twoje dane</h3>
      <p>
        Twoje imię widzą osoby, z którymi dzielisz listę. Twój adres e-mail widzi właściciel listy,
        na której jesteś uczestnikiem. Treść listy widzą tylko jej właściciel i uczestnicy. Nie
        przekazujemy ani nie sprzedajemy danych nikomu innemu; przechowuje je dostawca hostingu na
        serwerach w Unii Europejskiej.
      </p>
      <h3>Bez zewnętrznej analityki</h3>
      <p>
        Nie używamy narzędzi analitycznych, reklamowych ani śledzących. Jedyne ciasteczko to
        ciasteczko sesji, bez którego nie da się zalogować.
      </p>
      <h3>Usunięcie konta</h3>
      <p>
        Konto możesz usunąć w ustawieniach konta. Usuwamy wtedy Twoje dane i Twoje listy, także u
        ich uczestników. Pozycje dodane przez Ciebie na cudzych listach zostają z podpisem „usunięty
        użytkownik”.
      </p>
      <h3>Kopie zapasowe</h3>
      <p>
        Kopie bazy danych przechowujemy przez 7 dni. Po tym czasie usunięte dane znikają także z
        kopii.
      </p>
    </>
  );
}

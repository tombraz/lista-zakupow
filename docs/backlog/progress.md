# Progress log (build-epic)
2026-10-28 18:11 | T-003 | implementer | NEEDS_USER | AC2 Maestro i AC3 CI wymagają realnego przebiegu CI (push)
2026-10-28 19:09 | T-003 | implementer | NEEDS_USER | skrypt emulatora z timeoutem i diagnostyką; prosi o push epiku + ci-test/T-003-docs i draft PR testowy
2026-10-28 19:32 | T-003 | implementer | NEEDS_USER | AC3 skip udowodniony (PR #8), mobile-ios zielony; poprawka ANDROID_AVD_HOME, prosi o push epiku
2026-10-28 20:01 | T-003 | implementer | IN_QA | CI na PR #1 zielone (Maestro passed), skip na PR #8; limit E2E podniesiony do 35 min (niewypchnięty)
2026-10-28 20:13 | T-003 | qa | PASS | 0 blocker/0 major/4 minor; m.in. lint SEC2, tsconfig nadpisywany przez expo start, E2E Android ~24 min
2026-10-28 21:07 | T-007 | implementer | IN_QA | odhaczanie, kto kupił, czyszczenie kupionych (web); 285 testów + 26 E2E zielone
2026-10-28 21:22 | T-007 | qa | PASS | 0/0/4 minor; S-01-04 done; brak wpisów w data-model.md/api.md, pusta lista SC-05 = Wszystko kupione
2026-10-28 22:48 | T-008 | implementer | IN_QA | linki zaproszeń (7 dni, jednorazowe) i przyjęcie SC-08; 340 vitest + 32 E2E zielone
2026-10-29 07:26 | T-008 | qa | FAIL | TH-08: tokeny zaproszeń w logach API (/zaproszenie/<token> poza redactedUrl)
2026-10-29 07:46 | T-008 | implementer | IN_QA | fix QA #1: redakcja tokenu w /zaproszenie/ w logach API; 341 + 32 E2E zielone
2026-10-29 08:07 | T-008 | qa | PASS | runda 2: bloker naprawiony; S-01-05 done; minor: redakcja pomija /Zaproszenie/ i //zaproszenie/
2026-10-29 10:18 | T-009 | implementer | IN_QA | WebSocket /api/v1/live + klient web na żywo (SC-05/06/07); testy + 34 E2E zielone
2026-10-29 10:40 | T-009 | qa | PASS | 0/0/4 minor; S-01-06 done; wyścig subscribe/revoke do zamknięcia przed S-02-02, flaky InvitationScreen.entry
2026-10-29 11:58 | T-010 | implementer | NEEDS_USER | lokalnie obraz+smoke+Trivy+ZAP OK; realny deploy wymaga Fly/Neon staging od właściciela + zgoda na edycję deployment.md
2026-10-29 13:18 | T-010 | user | ANSWER | kroki Fly/Neon wykonane; deploy przez tymczasowy wyzwalacz push na gałęzi, zgoda na deployment.md i błędną migrację
2026-10-29 13:27 | T-010 | implementer | NEEDS_USER | wyzwalacz deploy-test/**, obraz w GHCR OK; job staging padł: brak FLY_API_TOKEN w środowisku staging
2026-10-29 13:44 | T-010 | user | ANSWER | token Fly + karta + GHCR publiczny; run 40872833932 próba 3: image/staging/zap zielone
2026-10-29 14:40 | T-010 | implementer | IN_QA | deploy na lista-staging.fly.dev z migracjami/smoke/ZAP zielony; błędna migracja zatrzymuje wdrożenie; AC6 w deployment.md

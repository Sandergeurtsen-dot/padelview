# Padel Motion Coach

Mobiele webapp voor live padel analyse met:

- cameratoegang vanaf je telefoon
- spelertracking met automatische focus
- skeletlijnen over schouders, armen, heupen en benen
- biomechanische techniekanalyse als interne basis voor scoring en coaching
- heuristische herkenning van `forehand`, `backhand`, `volley` en `overhead / smash`
- trainingssessies met slagregistratie per slagsoort
- telling van goede versus minder goede slagen per sessie
- automatische eindsamenvatting zodra je een sessie stopt
- optionele sessie-opname die je na afloop kunt downloaden
- live analyse-readiness zodat je ziet of de speler goed in beeld staat
- mobiele inzichten per modus: `Live`, `Sessie` en `Coach`
- meerlagige mobiele cockpit met een kernkaart per modus en horizontale detaildecks
- gescheiden `Acties` en `Instellingen` voor sneller gebruik op je telefoon
- recente slagentimeline, sterkste/zwakste slag en sessiesignaal
- coachrapport met patronen, zwakke punten en trainingstips
- exporteerbaar sessierapport en lokale opslag van je laatste sessiesamenvatting
- live coachingregels vertaald naar simpele, bruikbare trainingscues

## Lokaal starten

Gebruik een lokale webserver, want cameratoegang werkt niet goed via `file://`.

```bash
python3 -m http.server 4173
```

Open daarna:

- `http://localhost:4173` op desktop voor snelle controle
- `http://<jouw-lokale-ip>:4173` op je telefoon binnen hetzelfde netwerk

## Belangrijke notitie

De app gebruikt in de browser het MediaPipe pose-model via CDN en een extern modelbestand. De eerste laadbeurt heeft daarom internet nodig. Daarna draait de analyse live in de browser op het toestel zelf.

## Praktische opname-tip

Voor de beste herkenning:

- film met de achtercamera
- zet de telefoon stabiel neer
- houd schouders, heupen, knieën en polsen in beeld
- plaats de camera schuin achter de speler of langs de zijlijn

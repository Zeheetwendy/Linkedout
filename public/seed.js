// Verzonnen voorbeeldposts, zodat de feed bij de eerste keer openen laat zien wat LinkedOut is.
// `ago` = uren geleden. `reactions` = startaantallen.
window.LINKEDOUT_SEED = [
  {
    id: 's1', type: 'vertrek', author: 'Opgeluchte Consultant', ago: 2,
    data: {
      waar: 'een consultancybureau', functie: 'senior consultant',
      zei: 'Ik ben toe aan een nieuwe uitdaging.',
      echt: 'Ik maakte zestig uur per week slides die niemand las. Toen mijn manager mijn vakantie "een mooi moment om bij te lezen" noemde, wist ik genoeg.',
    },
    reactions: { herkenbaar: 214, au: 87, respect: 132 },
  },
  {
    id: 's2', type: 'meeting', author: 'Vermoeide Planner', ago: 5,
    data: {
      onderwerp: 'Voorbespreking van de kwartaalreview', mensen: 9, minuten: 90, alt: 'een mail',
      tekst: 'We hebben anderhalf uur besproken wat we volgende week in de echte meeting gaan bespreken.',
    },
    reactions: { herkenbaar: 341, au: 58, respect: 12 },
  },
  {
    id: 's3', type: 'mens', author: 'Nuchtere Verpleegkundige', ago: 9,
    data: {
      rol: 'leidinggevende', context: 'een zorginstelling', score: 5,
      tekst: 'Zei na mijn eerste fout: "Goed dat je het meldt, wat heb je nodig?" Twaalf jaar later is dat nog steeds mijn maatstaf voor iedere baas.',
    },
    reactions: { herkenbaar: 64, au: 3, respect: 290 },
  },
  {
    id: 's4', type: 'irritant', author: 'Dwarse Beleidsmedewerker', ago: 20,
    data: {
      ding: 'Op vrijdagmiddag om 16:45 een mail sturen die begint met "even snel".',
      beter: 'Maandag sturen. Of niet.',
    },
    reactions: { herkenbaar: 402, au: 120, respect: 31 },
  },
  {
    id: 's5', type: 'tip', author: 'Eerlijke Developer', ago: 27,
    data: {
      tekst: 'Zeg in een overleg hardop "ik snap dit niet". Meestal snapt de halve tafel het ook niet, en is iedereen opgelucht dat iemand het zegt.',
    },
    reactions: { herkenbaar: 156, au: 4, respect: 233 },
  },
  {
    id: 's6', type: 'vertrek', author: 'Uitgecheckte Marketeer', ago: 49,
    data: {
      waar: 'een scale-up', functie: 'marketeer',
      zei: 'Ik wil me verder ontwikkelen.',
      echt: 'De pingpongtafel kwam er wel, een salarisverhoging in drie jaar niet. "We zijn een familie" betekende vooral dat overwerk niet werd betaald.',
    },
    reactions: { herkenbaar: 287, au: 143, respect: 76 },
  },
  {
    id: 's7', type: 'mens', author: 'Kritische Officemanager', ago: 73,
    data: {
      rol: 'collega', context: 'een gemeente', score: 2,
      tekst: 'Stuurde na elk overleg een mail "even ter bevestiging", met de leidinggevende in de cc. Aan de koffieautomaat altijd vriendelijk. Ik ben er nooit achter gekomen welke van de twee echt was.',
    },
    reactions: { herkenbaar: 198, au: 91, respect: 9 },
  },
  {
    id: 's8', type: 'meeting', author: 'Onverbloemde Teamleider', ago: 98,
    data: {
      onderwerp: 'Wekelijkse stand-up (zittend)', mensen: 12, minuten: 45, alt: 'een appje',
      tekst: 'Twaalf mensen vertellen om de beurt dat alles loopt zoals vorige week.',
    },
    reactions: { herkenbaar: 265, au: 37, respect: 5 },
  },
  {
    id: 's9', type: 'irritant', author: 'Zachte Docent', ago: 124,
    data: {
      ding: '"Hoe gaat het?" vragen en al doorlopen voordat het antwoord komt.',
      beter: 'Blijven staan. Of gewoon "hoi" zeggen.',
    },
    reactions: { herkenbaar: 311, au: 66, respect: 40 },
  },
  {
    id: 's10', type: 'tip', author: 'Ontwaakte Accountmanager', ago: 150,
    data: {
      tekst: 'Zet in je afwezigheidsmelding dat je mail niet terugleest, en vanaf welke dag iemand het opnieuw mag sturen. Scheelt tweehonderd mails bij terugkomst.',
    },
    reactions: { herkenbaar: 88, au: 2, respect: 174 },
  },
];

/**
 * Service Google Places API
 * Gère les requêtes, pagination, variantes et déduplication
 */

const https = require('https');

const API_KEY = () => process.env.GOOGLE_API_KEY;
const PLACES_TEXT_SEARCH_URL = 'https://maps.googleapis.com/maps/api/place/textsearch/json';
const PLACES_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';

// Délai entre les requêtes pour éviter le rate limiting
const DELAY_BETWEEN_REQUESTS = 300; // ms
const DELAY_PAGINATION = 2200;       // Google exige ~2s avant next_page_token

/**
 * Pause utilitaire
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Requête HTTP GET générique (promisifiée)
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Réponse API invalide (JSON malformé)'));
        }
      });
    }).on('error', (err) => reject(err));
  });
}

/**
 * Génère des variantes de recherche pour maximiser les résultats
 * Ex: "plombier Auxerre" → ["plombier Auxerre", "plomberie Auxerre", ...]
 */
function generateSearchVariants(query) {
  const parts = query.trim().split(/\s+/);
  const location = parts.slice(1).join(' ') || '';
  const metier = parts[0] || query;

  // Dictionnaire de synonymes/variantes par secteur
  const synonymMap = {
    plombier:     ['plombier', 'plomberie', 'dépannage plomberie', 'artisan plombier', 'urgence plombier'],
    electricien:  ['électricien', 'électricité', 'dépannage électrique', 'artisan électricien', 'installation électrique'],
    menuisier:    ['menuisier', 'menuiserie', 'artisan menuisier', 'menuiserie bois', 'ébéniste'],
    carreleur:    ['carreleur', 'carrelage', 'pose carrelage', 'artisan carreleur'],
    peintre:      ['peintre', 'peinture bâtiment', 'artisan peintre', 'peinture intérieure', 'peinture extérieure'],
    maçon:        ['maçon', 'maçonnerie', 'artisan maçon', 'entreprise maçonnerie', 'gros oeuvre'],
    serrurier:    ['serrurier', 'serrurerie', 'dépannage serrurier', 'urgence serrurier', 'installation serrure'],
    vitrier:      ['vitrier', 'vitrerie', 'miroiterie', 'remplacement vitres', 'pose vitres'],
    chauffagiste: ['chauffagiste', 'chauffage', 'installation chauffage', 'dépannage chaudière', 'plombier chauffagiste'],
    climatisation:['climatisation', 'clim', 'installation climatisation', 'dépannage climatisation', 'pompe à chaleur'],
    couvreur:     ['couvreur', 'couverture', 'toiture', 'artisan couvreur', 'réparation toiture'],
    jardinier:    ['jardinier', 'jardinage', 'paysagiste', 'entretien jardin', 'espaces verts'],
    restaurant:   ['restaurant', 'brasserie', 'bistrot', 'pizzeria', 'cuisine'],
    avocat:       ['avocat', 'cabinet avocat', 'juridique', 'conseil juridique'],
    dentiste:     ['dentiste', 'chirurgien dentiste', 'cabinet dentaire', 'orthodontiste'],
    médecin:      ['médecin', 'docteur', 'généraliste', 'cabinet médical'],
    coiffeur:     ['coiffeur', 'salon coiffure', 'barbier', 'coiffure'],
    garage:       ['garage', 'mécanique auto', 'réparation voiture', 'carrosserie', 'auto'],
  };

  // Cherche si le métier a des synonymes
  const metierLower = metier.toLowerCase();
  let variants = null;

  for (const [key, syns] of Object.entries(synonymMap)) {
    if (metierLower.includes(key)) {
      variants = syns.map((s) => (location ? `${s} ${location}` : s));
      break;
    }
  }

  // Si pas de synonymes connus, génère des variantes génériques
  if (!variants) {
    variants = [
      query,
      `${metier} ${location}`,
      `artisan ${metier} ${location}`,
      `entreprise ${metier} ${location}`,
      `professionnel ${metier} ${location}`,
    ].filter((v, i, arr) => arr.indexOf(v) === i); // dédoublonne
  }

  // Variantes supplémentaires toujours ajoutées
  const extras = [
    `${metier} pas cher ${location}`,
    `meilleur ${metier} ${location}`,
  ];

  const allVariants = [...variants, ...extras]
    .map((v) => v.trim())
    .filter((v, i, arr) => arr.indexOf(v) === i && v.length > 2);

  console.log(`📋 Variantes générées (${allVariants.length}): ${allVariants.join(' | ')}`);
  return allVariants;
}

/**
 * Recherche Text Search avec pagination complète
 * Récupère jusqu'à 60 résultats (3 pages × 20)
 */
async function fetchAllPages(query) {
  const results = [];
  let pageToken = null;
  let pageNum = 0;

  do {
    pageNum++;
    let url = `${PLACES_TEXT_SEARCH_URL}?query=${encodeURIComponent(query)}&key=${API_KEY()}&language=fr`;
    if (pageToken) url += `&pagetoken=${pageToken}`;

    console.log(`  📄 Page ${pageNum} pour "${query}"...`);

    try {
      const data = await httpGet(url);

      if (data.status === 'REQUEST_DENIED') {
        throw new Error(`API refusée: ${data.error_message}`);
      }

      if (data.status === 'OVER_QUERY_LIMIT') {
        console.warn('  ⚠️ Quota dépassé, pause de 5s...');
        await sleep(5000);
        continue;
      }

      if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
        if (data.results) results.push(...data.results);
        pageToken = data.next_page_token || null;
      } else {
        pageToken = null;
      }

    } catch (err) {
      console.error(`  ❌ Erreur page ${pageNum}:`, err.message);
      pageToken = null;
    }

    // Google exige un délai avant d'utiliser next_page_token
    if (pageToken) {
      await sleep(DELAY_PAGINATION);
    }

  } while (pageToken && pageNum < 3); // Max 3 pages = 60 résultats

  return results;
}

/**
 * Récupère les détails d'un lieu (téléphone, site web, etc.)
 */
async function fetchPlaceDetails(placeId) {
  const fields = 'name,formatted_phone_number,website,url,rating,user_ratings_total,formatted_address';
  const url = `${PLACES_DETAILS_URL}?place_id=${placeId}&fields=${fields}&key=${API_KEY()}&language=fr`;

  try {
    const data = await httpGet(url);
    if (data.status === 'OK') return data.result;
  } catch (err) {
    console.error(`  ⚠️ Détails manquants pour ${placeId}`);
  }
  return null;
}

/**
 * Déduplique les résultats par place_id (puis par nom+adresse en fallback)
 */
function deduplicateResults(places) {
  const seen = new Map();

  for (const place of places) {
    const key = place.place_id || `${place.name}__${place.formatted_address}`;
    if (!seen.has(key)) {
      seen.set(key, place);
    }
  }

  return Array.from(seen.values());
}

/**
 * Formate un résultat brut en objet lead propre
 */
function formatLead(place, details) {
  const d = details || {};
  return {
    name:            place.name || d.name || '',
    address:         d.formatted_address || place.formatted_address || '',
    phone:           d.formatted_phone_number || '',
    website:         d.website || '',
    rating:          d.rating ?? place.rating ?? '',
    reviews:         d.user_ratings_total ?? place.user_ratings_total ?? 0,
    google_maps_url: d.url || `https://www.google.com/maps/place/?q=place_id:${place.place_id}`,
    place_id:        place.place_id || '',
  };
}

/**
 * Fonction principale : recherche complète multi-variantes
 */
async function searchLeads(query) {
  const variants = generateSearchVariants(query);
  const allRawPlaces = [];

  // Lancer la recherche pour chaque variante
  for (let i = 0; i < variants.length; i++) {
    const variant = variants[i];
    console.log(`\n🔎 Variante ${i + 1}/${variants.length}: "${variant}"`);

    const places = await fetchAllPages(variant);
    console.log(`  → ${places.length} résultats bruts`);
    allRawPlaces.push(...places);

    // Délai entre chaque variante
    if (i < variants.length - 1) {
      await sleep(DELAY_BETWEEN_REQUESTS);
    }
  }

  // Déduplication
  const uniquePlaces = deduplicateResults(allRawPlaces);
  console.log(`\n🔗 ${allRawPlaces.length} bruts → ${uniquePlaces.length} uniques après déduplication`);

  // Récupération des détails (téléphone, site web)
  const leads = [];
  const batchSize = 5; // Traitement par lots pour ne pas spammer l'API

  for (let i = 0; i < uniquePlaces.length; i += batchSize) {
    const batch = uniquePlaces.slice(i, i + batchSize);

    const batchResults = await Promise.all(
      batch.map(async (place, j) => {
        await sleep(j * 150); // Décalage intra-lot
        const details = place.place_id ? await fetchPlaceDetails(place.place_id) : null;
        return formatLead(place, details);
      })
    );

    leads.push(...batchResults);
    console.log(`  📦 Détails récupérés: ${Math.min(i + batchSize, uniquePlaces.length)}/${uniquePlaces.length}`);

    if (i + batchSize < uniquePlaces.length) {
      await sleep(200);
    }
  }

  // Trier par nombre d'avis (les plus connus en premier)
  leads.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));

  return leads;
}

module.exports = { searchLeads };

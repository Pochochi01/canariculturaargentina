// Motor de búsqueda local de la ayuda: sin dependencias ni servicios externos.
// Normaliza, aplica sinónimos y una raíz simple, y puntúa por campo.

const STOP = new Set([
  'a', 'al', 'como', 'con', 'cual', 'de', 'del', 'el', 'en', 'es', 'hacer', 'hago', 'la', 'las', 'lo',
  'los', 'me', 'mi', 'mis', 'necesito', 'o', 'para', 'por', 'puedo', 'que', 'quiero', 'se', 'su', 'sus',
  'un', 'una', 'uno', 'y', 'donde', 'debo', 'tengo', 'favor', 'ayuda', 'si', 'no'
]);

const PESOS = { titulo: 5, keywords: 3, descripcion: 2, modulo: 2, cuerpo: 1 };

export const normalizar = (s = '') =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Raíz aproximada para español: plurales y terminaciones verbales frecuentes
export function raiz(w) {
  if (w.length <= 4) return w;
  return w
    .replace(/(aciones|iciones|acion|icion|amiento|imiento)$/, '')
    .replace(/(ando|iendo|ados|idos|adas|idas|ado|ido|ada|ida)$/, '')
    .replace(/(ar|er|ir)$/, '')
    .replace(/(es|s)$/, '')
    .replace(/[aeo]$/, '') || w;
}

const tokens = (s) =>
  normalizar(s).split(/[^a-z0-9ñ]+/).filter(w => w.length > 1 && !STOP.has(w));

// grupos: [['crear','cargar','alta',...], ...] → raíz de cada variante → raíz canónica
export function crearDiccionario(grupos = []) {
  const mapa = new Map();
  for (const g of grupos) {
    const canon = raiz(normalizar(g[0]));
    for (const v of g) mapa.set(raiz(normalizar(v)), canon);
  }
  return mapa;
}

const terminos = (texto, dic) => tokens(texto).map(t => { const r = raiz(t); return dic.get(r) || r; });

export function crearIndice(articulos, dic) {
  return articulos.map(a => {
    const pesos = new Map();
    const sumar = (texto, peso) => {
      for (const t of terminos(texto, dic)) pesos.set(t, Math.max(pesos.get(t) || 0, peso));
    };
    sumar(a.titulo, PESOS.titulo);
    sumar((a.keywords || []).join(' '), PESOS.keywords);
    sumar(a.descripcion, PESOS.descripcion);
    sumar(`${a.modulo} ${a.categoria}`, PESOS.modulo);
    sumar([...(a.pasos || []), ...(a.erroresFrecuentes || [])].join(' '), PESOS.cuerpo);
    return { articulo: a, pesos, claves: [...pesos.keys()], enTitulo: new Set(terminos(a.titulo, dic)) };
  });
}

// Devuelve [{ articulo, score }] ordenado; score 0 se descarta
export function buscar(indice, consulta, dic, limite = 20) {
  const q = [...new Set(terminos(consulta, dic))];
  if (!q.length) return [];
  const res = [];
  for (const doc of indice) {
    let score = 0, encontrados = 0;
    for (const t of q) {
      let p = doc.pesos.get(t) || 0;
      if (!p && t.length >= 3) {
        // coincidencia parcial (prefijo) con la mitad del peso
        const parcial = doc.claves.find(k => k.startsWith(t) || (k.length >= 3 && t.startsWith(k)));
        if (parcial) p = doc.pesos.get(parcial) / 2;
      }
      if (p) { score += p; encontrados++; }
    }
    if (!score) continue;
    // Bonus cuando el título contiene todos los términos de la consulta
    const titulo = q.every(t => doc.enTitulo.has(t)) ? 2 : 1;
    res.push({ articulo: doc.articulo, score: score * (encontrados / q.length) * titulo });
  }
  return res.sort((a, b) => b.score - a.score).slice(0, limite);
}

// Lógica del asistente: una respuesta clara, varias opciones, o categorías sugeridas
export function responder(indice, consulta, dic) {
  const res = buscar(indice, consulta, dic, 6);
  if (!res.length) return { tipo: 'ninguno' };
  const [primero, segundo] = res;
  if (!segundo || primero.score >= segundo.score * 1.5) return { tipo: 'unico', articulo: primero.articulo };
  const corte = primero.score * 0.6;
  return { tipo: 'varios', articulos: res.filter(r => r.score >= corte).map(r => r.articulo).slice(0, 5) };
}

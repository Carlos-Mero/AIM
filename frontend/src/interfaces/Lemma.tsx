interface Lemma {
  id: number;
  title: string;
  statement: string;
  proof: string;
  status: 'pending' | 'in_progress' | 'proved' | 'invalid';
  // difficulty removed; importance is derived from reviews
  // timestamp strings from backend
  createdAt: string;
  lastUpdated: string;
  // number of reviews done on this lemma
  reviews: number;
  // any comment or feedback from verification
  comment: string;
  // list of memory IDs this lemma depends on
  deps: number[];
}

export default Lemma;

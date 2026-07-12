'use client';

import { useState, useTransition, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import {
  createBudgetLineItem,
  updateBudgetLineItem,
  deleteBudgetLineItem,
  type BudgetLineItem,
} from '@/lib/finance/actions';

const fmt = (v: number) =>
  new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(v);

const TIPOS_EQUIPO = [
  'Equipo especializado', 'Uniforme especializado', 'Equipo / Uniforme AO',
  'Insumos', 'Transporte Aéreo', 'Transporte terrestre (Ded)',
  'Transporte terrestre (ADO)', 'Hospedaje', 'Viáticos',
];

const DISCIPLINAS_DEPORTIVAS = [
  'TIRO', 'CANOTAJE', 'BÁDMINTON', 'JUDO', 'KARATE', 'TKD',
  'GIMNASIA', 'BREAKING', 'ATLETISMO', 'NATACIÓN', 'BOX', 'NUTRICIÓN',
];

const CIUDADES = [
  'León, Gto.', 'Monterrey, N.L.', 'Puebla, Pue.', 'Progreso, Yuc.',
  'Acapulco, Gro.', 'Guadalajara, Jal.', 'Tlaxcala, Tlax.', 'CDMX',
  'CDMX (COM)', 'Guadalajara, Jal. (GDL)', 'Monterrey, N.L. (MTY)',
  'Tijuana, B.C. (TIJ)', 'Mérida, Yuc. (MER)', 'Veracruz, Ver. (VER)',
];

function isTravelType(tipo: string) {
  return ['Transporte Aéreo', 'Transporte terrestre (Ded)',
    'Transporte terrestre (ADO)', 'Hospedaje', 'Viáticos'].includes(tipo);
}

// ── Editable row ──────────────────────────────────────────────────────────────
function LineItemRow({
  item, budgetId, canManage, allTipos, allDisciplinas,
}: {
  item: BudgetLineItem;
  budgetId: string;
  canManage: boolean;
  allTipos: string[];
  allDisciplinas: string[];
}) {
  const t = useTranslations('finances.lineItems');
  const tApproval = useTranslations('finances.approval');
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [localTipo, setLocalTipo] = useState(item.tipo_equipo);

  function handleEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('budget_id', budgetId);
    startTransition(async () => {
      const res = await updateBudgetLineItem(item.id, fd);
      if (res.error) setError(res.error);
      else setMode('view');
    });
  }

  function handleDelete() {
    if (!confirm(t('deleteConfirm', { name: item.articulo }))) return;
    startTransition(async () => {
      const res = await deleteBudgetLineItem(item.id, budgetId);
      if (res.error) setError(res.error);
    });
  }

  const disciplinaOptions = isTravelType(localTipo) ? CIUDADES : DISCIPLINAS_DEPORTIVAS;

  if (mode === 'edit') {
    return (
      <tr>
        <td colSpan={canManage ? 7 : 6} className="px-3 py-3 bg-indigo-50">
          {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
          <form onSubmit={handleEdit} className="grid grid-cols-6 gap-2 items-end">
            <input type="hidden" name="budget_id" value={budgetId} />
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{t('tipoLabel')}</label>
              <select name="tipo_equipo" required value={localTipo} onChange={e => setLocalTipo(e.target.value)}
                className="w-full text-xs rounded border border-gray-300 px-1.5 py-1 focus:outline-none">
                {allTipos.map(t2 => <option key={t2}>{t2}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">
                {isTravelType(localTipo) ? t('cityLabel') : t('disciplinaLabel')}
              </label>
              <select name="disciplina" required defaultValue={item.disciplina}
                className="w-full text-xs rounded border border-gray-300 px-1.5 py-1 focus:outline-none">
                {disciplinaOptions.map(d => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-0.5">{t('articuloLabel')}</label>
              <input name="articulo" required defaultValue={item.articulo}
                className="w-full text-xs rounded border border-gray-300 px-1.5 py-1 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{t('unitsLabel')}</label>
              <input name="unidades" type="number" required min={0.01} step="0.01" defaultValue={item.unidades}
                className="w-full text-xs rounded border border-gray-300 px-1.5 py-1 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-0.5">{t('priceLabel')}</label>
              <input name="precio_unitario" type="number" required min={0} step="0.01" defaultValue={item.precio_unitario}
                className="w-full text-xs rounded border border-gray-300 px-1.5 py-1 focus:outline-none" />
            </div>
            <div className="col-span-6 flex gap-2 justify-end mt-1">
              <button type="button" onClick={() => { setMode('view'); setError(null); }}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">
                {tApproval('cancel')}
              </button>
              <button type="submit" disabled={isPending}
                className="px-3 py-1 text-xs bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
                {isPending ? tApproval('processing') : tApproval('approve') === 'Approve' ? 'Save' : 'Guardar'}
              </button>
            </div>
          </form>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50 transition-colors">
      <td className="px-3 py-2 text-xs text-gray-600 whitespace-nowrap">{item.tipo_equipo}</td>
      <td className="px-3 py-2 text-xs font-medium text-gray-800 whitespace-nowrap">{item.disciplina}</td>
      <td className="px-3 py-2 text-xs text-gray-700 max-w-[280px]">
        <span className="line-clamp-2">{item.articulo}</span>
      </td>
      <td className="px-3 py-2 text-xs text-right text-gray-700">{Number(item.unidades)}</td>
      <td className="px-3 py-2 text-xs text-right text-gray-700">{fmt(item.precio_unitario)}</td>
      <td className="px-3 py-2 text-xs text-right font-semibold text-gray-900">{fmt(item.total)}</td>
      {canManage && (
        <td className="px-3 py-2 text-right">
          {error && <p className="text-xs text-red-500 mb-1">{error}</p>}
          <div className="flex gap-1 justify-end">
            <button onClick={() => setMode('edit')}
              className="px-2 py-0.5 text-xs bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200">
              {tApproval('approve') === 'Approve' ? 'Edit' : 'Editar'}
            </button>
            <button onClick={handleDelete} disabled={isPending}
              className="px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 disabled:opacity-50">
              {isPending ? '…' : tApproval('approve') === 'Approve' ? 'Del' : 'Borrar'}
            </button>
          </div>
        </td>
      )}
    </tr>
  );
}

// ── Add form ──────────────────────────────────────────────────────────────────
function AddLineItemForm({ budgetId, onDone }: { budgetId: string; onDone: () => void }) {
  const t = useTranslations('finances.lineItems');
  const tApproval = useTranslations('finances.approval');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [tipo, setTipo] = useState(TIPOS_EQUIPO[0]);
  const [unidades, setUnidades] = useState(1);
  const [precio, setPrecio] = useState(0);
  const disciplinaOptions = isTravelType(tipo) ? CIUDADES : DISCIPLINAS_DEPORTIVAS;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    fd.set('budget_id', budgetId);
    startTransition(async () => {
      const res = await createBudgetLineItem(fd);
      if (res.error) setError(res.error);
      else { e.currentTarget.reset(); setTipo(TIPOS_EQUIPO[0]); setUnidades(1); setPrecio(0); onDone(); }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-indigo-50 p-4 rounded-lg">
      <input type="hidden" name="budget_id" value={budgetId} />
      <h4 className="text-sm font-semibold text-indigo-800">{t('newArticleTitle')}</h4>
      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('tipoLabel')}</label>
          <select name="tipo_equipo" required value={tipo} onChange={e => setTipo(e.target.value)}
            className="w-full text-sm rounded border border-gray-300 px-2 py-1.5 focus:outline-none">
            {TIPOS_EQUIPO.map(t2 => <option key={t2}>{t2}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            {isTravelType(tipo) ? t('cityLabel') : t('disciplinaLabel')}
          </label>
          <select name="disciplina" required
            className="w-full text-sm rounded border border-gray-300 px-2 py-1.5 focus:outline-none">
            {disciplinaOptions.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div className="sm:col-span-1 col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('articuloLabel')}</label>
          <input name="articulo" required
            className="w-full text-sm rounded border border-gray-300 px-2 py-1.5 focus:outline-none"
            placeholder={t('articuloPlaceholder')} />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('unitsLabel')}</label>
          <input name="unidades" type="number" min={0.01} step="0.01"
            value={unidades} onChange={e => setUnidades(parseFloat(e.target.value) || 0)}
            className="w-full text-sm rounded border border-gray-300 px-2 py-1.5 focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('priceLabel')}</label>
          <input name="precio_unitario" type="number" min={0} step="0.01"
            value={precio} onChange={e => setPrecio(parseFloat(e.target.value) || 0)}
            className="w-full text-sm rounded border border-gray-300 px-2 py-1.5 focus:outline-none" />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('calculatedTotal')}</label>
          <div className="text-sm font-semibold text-indigo-800 bg-white border border-indigo-200 rounded px-2 py-1.5">
            {fmt(unidades * precio)}
          </div>
        </div>

        <div className="col-span-2 sm:col-span-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">{t('notesLabel')}</label>
          <input name="notas" className="w-full text-sm rounded border border-gray-300 px-2 py-1.5 focus:outline-none"
            placeholder={t('notesPlaceholder')} />
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone}
          className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50">
          {tApproval('cancel')}
        </button>
        <button type="submit" disabled={isPending}
          className="px-3 py-1.5 text-sm bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">
          {isPending ? tApproval('processing') : t('addBtn')}
        </button>
      </div>
    </form>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function BudgetLineItemsClient({
  budgetId, initialItems, canManage,
}: {
  budgetId: string;
  initialItems: BudgetLineItem[];
  canManage: boolean;
}) {
  const t = useTranslations('finances.lineItems');
  const [showAdd, setShowAdd] = useState(false);
  const [filterTipo, setFilterTipo] = useState('');
  const [filterDisc, setFilterDisc] = useState('');
  const [search, setSearch] = useState('');

  const allTipos       = useMemo(() => [...new Set(initialItems.map(i => i.tipo_equipo))].sort(), [initialItems]);
  const allDisciplinas = useMemo(() => [...new Set(initialItems.map(i => i.disciplina))].sort(), [initialItems]);

  const disciplinasForFilter = useMemo(() => {
    if (!filterTipo) return allDisciplinas;
    return [...new Set(initialItems.filter(i => i.tipo_equipo === filterTipo).map(i => i.disciplina))].sort();
  }, [filterTipo, initialItems, allDisciplinas]);

  const filtered = useMemo(() => {
    let items = initialItems;
    if (filterTipo) items = items.filter(i => i.tipo_equipo === filterTipo);
    if (filterDisc) items = items.filter(i => i.disciplina === filterDisc);
    if (search)     items = items.filter(i => i.articulo.toLowerCase().includes(search.toLowerCase()));
    return items;
  }, [initialItems, filterTipo, filterDisc, search]);

  const grandTotal = useMemo(() => filtered.reduce((s, i) => s + Number(i.total), 0), [filtered]);

  function clearFilters() { setFilterTipo(''); setFilterDisc(''); setSearch(''); }
  const hasFilters = !!filterTipo || !!filterDisc || !!search;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterTipo')}</label>
          <select value={filterTipo} onChange={e => { setFilterTipo(e.target.value); setFilterDisc(''); }}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none min-w-[180px]">
            <option value="">— {t('totalLabel')} —</option>
            {allTipos.map(t2 => <option key={t2}>{t2}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">
            {filterTipo && isTravelType(filterTipo) ? t('filterCity') : t('filterDisciplina')}
          </label>
          <select value={filterDisc} onChange={e => setFilterDisc(e.target.value)}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none min-w-[180px]">
            <option value="">— {t('totalLabel')} —</option>
            {disciplinasForFilter.map(d => <option key={d}>{d}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('filterSearch')}</label>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('filterPlaceholder')}
            className="rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:outline-none w-48" />
        </div>

        {hasFilters && (
          <button onClick={clearFilters}
            className="text-xs text-gray-500 hover:text-gray-700 underline self-end pb-2">
            {t('clearFilters')}
          </button>
        )}

        <div className="ml-auto self-end flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {filtered.length} · <strong className="text-gray-900">{fmt(grandTotal)}</strong>
          </span>
          {canManage && (
            <button onClick={() => setShowAdd(!showAdd)}
              className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                showAdd ? 'bg-gray-200 text-gray-700' : 'bg-indigo-600 text-white hover:bg-indigo-700'
              }`}>
              {showAdd ? t('hideArticleBtn') : t('newArticleBtn')}
            </button>
          )}
        </div>
      </div>

      {showAdd && (
        <AddLineItemForm budgetId={budgetId} onDone={() => setShowAdd(false)} />
      )}

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-10 text-center text-sm text-gray-400">
          {hasFilters ? t('noArticlesFiltered') : t('noArticles')}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('colTipo')}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('colDisciplina')}</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('colArticulo')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('colCajas')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('colPrecio')}</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">{t('colTotal')}</th>
                {canManage && <th className="px-3 py-2 w-20"></th>}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map(item => (
                <LineItemRow
                  key={item.id}
                  item={item}
                  budgetId={budgetId}
                  canManage={canManage}
                  allTipos={allTipos}
                  allDisciplinas={allDisciplinas}
                />
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td colSpan={canManage ? 5 : 4} className="px-3 py-2 text-sm font-semibold text-gray-700 text-right">
                  {hasFilters ? t('totalFiltered') : t('totalLabel')}
                </td>
                <td className="px-3 py-2 text-sm font-bold text-gray-900 text-right">{fmt(grandTotal)}</td>
                {canManage && <td />}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}

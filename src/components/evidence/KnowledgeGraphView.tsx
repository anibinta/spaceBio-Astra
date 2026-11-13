import { Maximize2, Network, Table, ZoomIn, ZoomOut } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { GraphData, GraphNode } from '../../domain/types';
import {
  CONDITION_LABELS,
  DIRECTION_LABELS,
  SYSTEM_LABELS,
  type Locale,
} from '../../i18n/labels';
import { CsvExportButton } from '../common/CsvExportButton';

interface KnowledgeGraphViewProps {
  graph: GraphData;
  locale: Locale;
  onOpenPublication: (publicationId: string, passageId?: string) => void;
}

const LAYER_ORDER: GraphNode['type'][] = [
  'organism',
  'condition',
  'system',
  'publication',
];

const NODE_COLORS: Record<GraphNode['type'], string> = {
  organism: '#0891b2',
  condition: '#d97706',
  system: '#2563eb',
  publication: '#475569',
};

export function KnowledgeGraphView({
  graph,
  locale,
  onOpenPublication,
}: KnowledgeGraphViewProps) {
  const [zoom, setZoom] = useState(1);
  const [tableView, setTableView] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<GraphNode['type'] | 'all'>('all');

  const formatNodeLabel = (node: GraphNode) => {
    if (node.type === 'condition') {
      return (
        CONDITION_LABELS[locale][
          node.label as keyof (typeof CONDITION_LABELS)['fr']
        ] ?? node.label
      );
    }
    if (node.type === 'system') {
      return (
        SYSTEM_LABELS[locale][
          node.label as keyof (typeof SYSTEM_LABELS)['fr']
        ] ?? node.label
      );
    }
    return node.label;
  };

  const layout = useMemo(() => {
    const width = 920;
    const colX = [100, 340, 580, 810];
    const positions = new Map<string, { x: number; y: number }>();
    let maxNodesInCol = 1;

    LAYER_ORDER.forEach((layer, colIdx) => {
      const colNodes = graph.nodes.filter((n) => n.type === layer);
      maxNodesInCol = Math.max(maxNodesInCol, colNodes.length);
      const spacing = 54;
      const startY = 56;
      colNodes.forEach((node, rowIdx) => {
        positions.set(node.id, {
          x: colX[colIdx],
          y: startY + rowIdx * spacing,
        });
      });
    });

    const height = Math.max(380, maxNodesInCol * 54 + 90);
    return { width, height, positions };
  }, [graph]);

  const highlightedEdges = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    return new Set(
      graph.edges
        .filter((e) => e.source === selectedNodeId || e.target === selectedNodeId)
        .map((e) => e.id),
    );
  }, [graph.edges, selectedNodeId]);

  const selectedNode = useMemo(
    () => graph.nodes.find((n) => n.id === selectedNodeId) ?? null,
    [graph.nodes, selectedNodeId],
  );

  const selectedEdges = useMemo(
    () =>
      selectedNodeId
        ? graph.edges.filter(
            (e) => e.source === selectedNodeId || e.target === selectedNodeId,
          )
        : [],
    [graph.edges, selectedNodeId],
  );

  const csvRows = graph.edges.map((e) => [
    e.source,
    e.relation,
    e.target,
    e.effectDirection ?? '',
    e.claimCount,
    e.passageIds.join('; '),
  ]);

  const visibleNodes =
    typeFilter === 'all'
      ? graph.nodes
      : graph.nodes.filter((n) => n.type === typeFilter);

  return (
    <section
      aria-labelledby="graph-heading"
      className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 p-5 space-y-4"
    >
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2
            id="graph-heading"
            className="text-base font-semibold text-slate-900 dark:text-slate-50"
          >
            {locale === 'fr'
              ? 'Graphe interactif des preuves (Organismes ↔ Conditions ↔ Systèmes ↔ Publications)'
              : 'Interactive Evidence Graph (Organisms ↔ Conditions ↔ Systems ↔ Publications)'}
          </h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            {locale === 'fr'
              ? `${graph.nodes.length} nœuds et ${graph.edges.length} relations traçables vers ${graph.passageIds.length} passages.`
              : `${graph.nodes.length} nodes and ${graph.edges.length} links traceable to ${graph.passageIds.length} passages.`}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {!tableView && (
            <div className="inline-flex items-center rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-0.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.6, Number((z - 0.15).toFixed(2))))}
                aria-label={locale === 'fr' ? 'Dézoomer le graphe' : 'Zoom out'}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <ZoomOut className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <span className="px-2 text-[11px] font-mono tabular-nums text-slate-600 dark:text-slate-300">
                {Math.round(zoom * 100)}%
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.6, Number((z + 0.15).toFixed(2))))}
                aria-label={locale === 'fr' ? 'Zoomer le graphe' : 'Zoom in'}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoom(1);
                  setSelectedNodeId(null);
                }}
                aria-label={locale === 'fr' ? 'Réinitialiser le zoom' : 'Reset zoom'}
                className="p-1.5 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setTableView((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap"
          >
            {tableView ? (
              <Network className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Table className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>
              {tableView
                ? locale === 'fr'
                  ? 'Vue graphe'
                  : 'Graph view'
                : locale === 'fr'
                  ? 'Vue tableau'
                  : 'Table view'}
            </span>
          </button>

          <CsvExportButton
            filename="spacebio-knowledge-graph.csv"
            headers={[
              'Source',
              'Relation',
              'Target',
              'EffectDirection',
              'ClaimCount',
              'PassageIDs',
            ]}
            rows={csvRows}
            locale={locale}
          />
        </div>
      </div>

      {/* Node type filter strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {(
          [
            ['all', locale === 'fr' ? 'Tous les nœuds' : 'All nodes'],
            ['organism', locale === 'fr' ? 'Organismes' : 'Organisms'],
            ['condition', locale === 'fr' ? 'Conditions' : 'Conditions'],
            ['system', locale === 'fr' ? 'Systèmes' : 'Systems'],
            ['publication', 'Publications'],
          ] as Array<[GraphNode['type'] | 'all', string]>
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTypeFilter(key)}
            className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
              typeFilter === key
                ? 'border-cyan-500 bg-cyan-50 dark:bg-cyan-950/60 text-cyan-800 dark:text-cyan-200'
                : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {graph.nodes.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 dark:border-slate-700 p-8 text-center text-xs text-slate-500 dark:text-slate-400">
          {locale === 'fr'
            ? 'Aucun nœud ne correspond aux filtres sélectionnés.'
            : 'No graph nodes match the selected filters.'}
        </div>
      ) : !tableView ? (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_290px] gap-4 items-start">
          <div className="overflow-auto rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70 max-h-[520px]">
            <svg
              role="img"
              aria-label={
                locale === 'fr'
                  ? 'Diagramme réseau reliant organismes, conditions, systèmes et publications'
                  : 'Network graph linking organisms, conditions, systems, and publications'
              }
              width={Math.round(layout.width * zoom)}
              height={Math.round(layout.height * zoom)}
              viewBox={`0 0 ${layout.width} ${layout.height}`}
              className="block"
            >
              {/* Column Headers */}
              <text x="100" y="24" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                {locale === 'fr' ? 'ORGANISMES' : 'ORGANISMS'}
              </text>
              <text x="340" y="24" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                {locale === 'fr' ? 'CONDITIONS' : 'CONDITIONS'}
              </text>
              <text x="580" y="24" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                {locale === 'fr' ? 'SYSTÈMES' : 'SYSTEMS'}
              </text>
              <text x="810" y="24" textAnchor="middle" className="fill-slate-500 text-[11px] font-semibold">
                PUBLICATIONS
              </text>

              {/* Edges */}
              {graph.edges.map((edge) => {
                const src = layout.positions.get(edge.source);
                const tgt = layout.positions.get(edge.target);
                if (!src || !tgt) return null;
                const isHighlighted =
                  !selectedNodeId || highlightedEdges.has(edge.id);
                const stroke =
                  edge.effectDirection === 'decrease'
                    ? '#f43f5e'
                    : edge.effectDirection === 'increase'
                      ? '#06b6d4'
                      : edge.effectDirection === 'no_effect'
                        ? '#f59e0b'
                        : '#64748b';
                const midX = (src.x + tgt.x) / 2;
                return (
                  <path
                    key={edge.id}
                    d={`M ${src.x + 65} ${src.y} C ${midX} ${src.y}, ${midX} ${tgt.y}, ${tgt.x - 65} ${tgt.y}`}
                    fill="none"
                    stroke={stroke}
                    strokeWidth={Math.min(4, 1 + edge.claimCount * 0.6)}
                    strokeOpacity={isHighlighted ? 0.78 : 0.14}
                  >
                    <title>{`${edge.source} → ${edge.target} (${edge.relation}, ${edge.claimCount} claims)`}</title>
                  </path>
                );
              })}

              {/* Nodes */}
              {visibleNodes.map((node) => {
                const pos = layout.positions.get(node.id);
                if (!pos) return null;
                const isSelected = selectedNodeId === node.id;
                const label = formatNodeLabel(node);
                const shortLabel =
                  label.length > 18 ? `${label.slice(0, 17)}…` : label;

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x - 70}, ${pos.y - 16})`}
                    onClick={() => {
                      setSelectedNodeId(isSelected ? null : node.id);
                      if (node.type === 'publication') {
                        const pubId = node.id.replace(/^pub:/, '');
                        onOpenPublication(pubId);
                      }
                    }}
                    className="cursor-pointer"
                  >
                    <rect
                      width="140"
                      height="32"
                      rx="6"
                      fill={isSelected ? '#083344' : '#0f172a'}
                      stroke={isSelected ? '#22d3ee' : NODE_COLORS[node.type]}
                      strokeWidth={isSelected ? 2 : 1.25}
                    />
                    <text
                      x="70"
                      y="20"
                      textAnchor="middle"
                      className="fill-slate-100 text-[11px] font-medium pointer-events-none"
                    >
                      {shortLabel}
                    </text>
                    <title>{`${label} (${node.count})`}</title>
                  </g>
                );
              })}
            </svg>
          </div>

          <aside className="rounded-md border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4 space-y-3">
            <h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {selectedNode
                ? formatNodeLabel(selectedNode)
                : locale === 'fr'
                  ? 'Inspecteur du graphe'
                  : 'Graph Inspector'}
            </h3>
            {!selectedNode ? (
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {locale === 'fr'
                  ? 'Cliquez sur un nœud du graphe pour isoler ses relations et ses passages sources. Cliquer sur un nœud Publication ouvre sa fiche complète.'
                  : 'Click any graph node to highlight its links and inspect source passages. Clicking a Publication node opens its full record.'}
              </p>
            ) : (
              <div className="space-y-2.5 text-xs">
                <p className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                  {selectedNode.type} · {selectedEdges.length}{' '}
                  {locale === 'fr' ? 'connexions' : 'connections'}
                </p>
                <ul className="space-y-2 max-h-72 overflow-y-auto">
                  {selectedEdges.map((edge) => (
                    <li
                      key={edge.id}
                      className="rounded border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-2 space-y-1"
                    >
                      <div className="font-medium text-slate-800 dark:text-slate-200">
                        {edge.relation in DIRECTION_LABELS[locale]
                          ? DIRECTION_LABELS[locale][
                              edge.relation as keyof (typeof DIRECTION_LABELS)['fr']
                            ]
                          : edge.relation}
                        {' → '}
                        <span className="font-mono text-[11px]">
                          {edge.target.replace(/^(org|cond|sys|pub):/, '')}
                        </span>
                      </div>
                      <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        {edge.claimCount} claims · {edge.passageIds.join(', ')}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-3 font-semibold">Source</th>
                <th className="py-2 pr-3 font-semibold">Relation</th>
                <th className="py-2 pr-3 font-semibold">Cible</th>
                <th className="py-2 pr-3 font-mono">Claims</th>
                <th className="py-2 font-mono">Passages</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {graph.edges.map((e) => (
                <tr key={e.id}>
                  <td className="py-2 pr-3 font-mono">{e.source}</td>
                  <td className="py-2 pr-3">{e.relation}</td>
                  <td className="py-2 pr-3 font-mono">{e.target}</td>
                  <td className="py-2 pr-3 font-mono tabular-nums">{e.claimCount}</td>
                  <td className="py-2 font-mono text-[11px] text-slate-500">
                    {e.passageIds.join(', ')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

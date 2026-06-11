/**
 * Re-exports engine document types from @texisstudio/plugins so that
 * visual-editor components can import them from a single local path
 * without spelling out the full alias + sub-path each time.
 */
export type { GraphNodeDocument, GraphNode, GraphEdge, NodeShape, EdgeType, LayoutAlgorithm } from "@texisstudio/plugins/engines/graph-node-engine/types.js";
export type { PGFPlotsDocument, DataSeries, PlotType, AxisScale } from "@texisstudio/plugins/engines/pgfplots-engine/types.js";
export type { MathEngineDocument, MatrixDocument, SystemDocument, MathNode, MathMode, MatrixDelimiter } from "@texisstudio/plugins/engines/math-engine/types.js";
export type { TimelineGanttDocument, TimelineTask, TimelineGroup, TimelineMode, TimeUnit } from "@texisstudio/plugins/engines/timeline-gantt-engine/types.js";
export type { TableDataDocument, DataColumn, DataRow, ColumnType, TableExportTarget } from "@texisstudio/plugins/engines/table-data-engine/types.js";
export type { TreeForestDocument, TreeNode, TreeStyle, TreeGrowth } from "@texisstudio/plugins/engines/tree-forest-engine/types.js";
export type { ChemEngineDocument, ChemElement, ChemFormula, ChemReaction, ChemStructure, ChemOutputMode, ReactionArrow } from "@texisstudio/plugins/engines/chemistry-engine/types.js";
export type { CircuiTikZDocument, CircuitComponent, CircuitNode, CircuitConnection, ComponentType, Direction } from "@texisstudio/plugins/engines/circuitikz-engine/types.js";
export type { TikzShapeDocument, TikzShape, ShapeType, LineStyle, Coordinate } from "@texisstudio/plugins/engines/tikz-shape-engine/types.js";

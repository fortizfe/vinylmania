import 'dart:math' as math;

import 'package:flutter/semantics.dart';
import 'package:material_ui/material_ui.dart';

import '../../../domain/models/collection_stats/growth_point.dart';
import '../stats_format.dart';

/// Per-month bars (records added) or the cumulative line, drawn up to
/// [progress] (0–1). Each month is its own semantics node, the native twin
/// of the web's hidden data table.
class GrowthChartPainter extends CustomPainter {
  GrowthChartPainter({
    required this.points,
    required this.cumulative,
    required this.progress,
    required this.color,
    required this.baselineColor,
  });

  final List<GrowthPoint> points;
  final bool cumulative;
  final double progress;
  final Color color;
  final Color baselineColor;

  static const _padX = 14.0;
  static const _padTop = 16.0;

  Rect _plot(Size size) =>
      Rect.fromLTRB(_padX, _padTop, size.width - _padX, size.height);

  @override
  void paint(Canvas canvas, Size size) {
    final plot = _plot(size);
    canvas.drawLine(
      plot.bottomLeft,
      plot.bottomRight,
      Paint()
        ..color = baselineColor
        ..strokeWidth = 1,
    );
    if (points.isEmpty) return;
    final fill = Paint()..color = color;

    if (!cumulative) {
      final maxAdded = points.map((p) => p.added).reduce(math.max);
      final slot = plot.width / points.length;
      for (final (i, p) in points.indexed) {
        final h = maxAdded == 0
            ? 0.0
            : p.added / maxAdded * plot.height * progress;
        final x = plot.left + i * slot + slot * 0.19;
        canvas.drawRRect(
          RRect.fromRectAndRadius(
            Rect.fromLTWH(x, plot.bottom - h, slot * 0.62, h),
            const Radius.circular(2),
          ),
          fill,
        );
      }
      return;
    }

    final offsets = _lineOffsets(plot);
    final line = Path()..moveTo(offsets.first.dx, offsets.first.dy);
    for (final o in offsets.skip(1)) {
      line.lineTo(o.dx, o.dy);
    }
    final area = Path.from(line)
      ..lineTo(offsets.last.dx, plot.bottom)
      ..lineTo(offsets.first.dx, plot.bottom)
      ..close();
    canvas.drawPath(
      area,
      Paint()..color = color.withValues(alpha: 0.1 * progress),
    );

    final drawn = Path();
    for (final metric in line.computeMetrics()) {
      drawn.addPath(
        metric.extractPath(0, metric.length * progress),
        Offset.zero,
      );
    }
    canvas.drawPath(
      drawn,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.5
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
    for (final o in offsets) {
      canvas.drawCircle(o, 3, fill);
    }
  }

  List<Offset> _lineOffsets(Rect plot) {
    final maxCumulative = math.max(1, points.last.cumulative);
    final step = points.length > 1 ? plot.width / (points.length - 1) : 0.0;
    return [
      for (final (i, p) in points.indexed)
        Offset(
          points.length > 1 ? plot.left + i * step : plot.center.dx,
          plot.bottom - p.cumulative / maxCumulative * plot.height,
        ),
    ];
  }

  @override
  SemanticsBuilderCallback get semanticsBuilder => (size) {
    final plot = _plot(size);
    final slot = plot.width / points.length;
    return [
      for (final (i, p) in points.indexed)
        CustomPainterSemantics(
          rect: Rect.fromLTWH(
            plot.left + i * slot,
            plot.top,
            slot,
            plot.height,
          ),
          properties: SemanticsProperties(
            label:
                '${formatPeriod(p.period)}: ${p.added} added, '
                '${p.cumulative} total',
            textDirection: TextDirection.ltr,
          ),
        ),
    ];
  };

  @override
  bool shouldRepaint(GrowthChartPainter oldDelegate) =>
      oldDelegate.points != points ||
      oldDelegate.cumulative != cumulative ||
      oldDelegate.progress != progress ||
      oldDelegate.color != color ||
      oldDelegate.baselineColor != baselineColor;

  @override
  bool shouldRebuildSemantics(GrowthChartPainter oldDelegate) =>
      oldDelegate.points != points;
}

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-native/no-inline-styles */

import React, {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  LayoutAnimation,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import type {
  GestureResponderEvent,
  StyleProp,
  ViewStyle,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import type { GridItem, ResponsiveGridProps, TileItem } from './types';
import { calcResponsiveGrid } from './calc-responsive-grid';
import useThrottle from '../hooks/use-throttle';
import { renderPropComponent } from '../libs/render-prop-component';

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  data = [],
  maxItemsPerColumn = 3,
  virtualizedBufferFactor = 5,
  renderItem,
  autoAdjustItemWidth = true,
  scrollEventInterval = 200, // milliseconds
  virtualization = true,
  showScrollIndicator = true,
  bounces = true,
  style = {},
  itemContainerStyle = {},
  itemUnitHeight,
  onScroll: onScrollProp,
  onEndReached,
  onEndReachedThreshold = 0.5, // default to 50% of the container height
  keyExtractor: keyExtractorProp,
  HeaderComponent = null,
  FooterComponent = null,
  direction = 'ltr',
  removeClippedSubviews = true,
  draggable = false,
  animation = false,
  dragActivationDelay = 250,
  dragScale = 1.03,
  dragOpacity = 0.95,
  dragPlaceholderColor = 'rgba(255, 255, 255, 0.25)',
  dragPlaceholderBorderColor = 'rgba(255, 255, 255, 0.6)',
  dragPlaceholderBorderWidth = 1,
  onDragStart,
  onDragEnd,
}) => {
  const keyExtractor =
    keyExtractorProp ?? ((_: TileItem, index: number) => String(index));

  const [orderedData, setOrderedData] = useState<TileItem[]>(data);
  const [visibleItems, setVisibleItems] = useState<GridItem[]>([]);

  const [activeDraggedItem, setActiveDraggedItem] = useState<TileItem | null>(
    null
  );

  const [dragSourceKeyState, setDragSourceKeyState] = useState<string | null>(
    null
  );

  const [dragTargetIndexState, setDragTargetIndexState] = useState(-1);

  const [isDraggingState, setIsDraggingState] = useState(false);

  const [activeDragLayout, setActiveDragLayout] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  // Ref for container view to measure absolute position
  const containerViewRef = useRef<View>(null);
  const containerScreenPositionRef = useRef({ x: 0, y: 0 });

  // Measure container position relative to screen
  const measureContainerPosition = () => {
    containerViewRef.current?.measureInWindow((x, y) => {
      containerScreenPositionRef.current = { x, y };
    });
  };

  // Extract padding values from style prop - renamed for clarity
  const [componentPadding, setComponentPadding] = useState({
    horizontal: 0,
    vertical: 0,
  });

  const onEndReachedCalled = useRef<boolean>(false);

  const scrollYPosition = useRef<number>(0);

  const dragOffset = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  const dragFromIndex = useRef<number>(-1);

  const dragCurrentIndex = useRef<number>(-1);

  const dragLastCenterRef = useRef<{ x: number; y: number } | null>(null);

  const dragTouchOffsetRef = useRef({ x: 0, y: 0 });

  const activeDragItemRef = useRef<TileItem | null>(null);

  const gridItemsRef = useRef<GridItem[]>([]);

  const lastLoggedPositionRef = useRef<string | null>(null);

  const orderedDataRef = useRef<TileItem[]>(orderedData);

  const activeDragLayoutRef = useRef<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  const isDragging = useRef<boolean>(false);

  const [footerComponentHeight, setFooterComponentHeight] = useState(0);

  const [headerComponentHeight, setHeaderComponentHeight] = useState(0);

  // Track measured heights for autoHeight items
  const [measuredHeights, setMeasuredHeights] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (
      Platform.OS === 'android' &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  // Get the effective width accounting for padding
  const effectiveWidth = containerSize.width - componentPadding.horizontal * 2;

  const isVirtualizationEnabled = virtualization && !draggable;

  const layoutData = orderedData;

  const { gridViewHeight, gridItems } = useMemo(
    () =>
      calcResponsiveGrid(
        layoutData,
        maxItemsPerColumn,
        effectiveWidth > 0 ? effectiveWidth : containerSize.width,
        itemUnitHeight,
        autoAdjustItemWidth
      ),
    [
      layoutData,
      maxItemsPerColumn,
      containerSize,
      effectiveWidth,
      autoAdjustItemWidth,
      itemUnitHeight,
      measuredHeights,
    ]
  );

  const renderedItems = isVirtualizationEnabled ? visibleItems : gridItems;

  useEffect(() => {
    orderedDataRef.current = orderedData;
  }, [orderedData]);

  useLayoutEffect(() => {
    gridItemsRef.current = gridItems;

    // Log all element positions when grid items are calculated
    if (gridItems.length > 0 && containerSize.width > 0) {
      const containerPos = containerScreenPositionRef.current;

      console.log('=== ResponsiveGrid Layout ===');
      console.log('Container dimensions:', {
        width: containerSize.width,
        height: containerSize.height,
      });
      console.log('Container screen position (absolute):', containerPos);
      console.log('Effective (padded) width:', effectiveWidth);
      console.log('Padding:', componentPadding);
      console.log('Scroll Y position:', scrollYPosition.current);
      console.log('--- Items ---');
      gridItems.forEach((item, index) => {
        const dataItem = orderedData[index];
        const absoluteX =
          containerPos.x + item.left + componentPadding.horizontal;
        const absoluteY =
          containerPos.y +
          item.top +
          componentPadding.vertical -
          scrollYPosition.current;

        console.log(`Item ${index}:`, {
          id: dataItem?.id ?? index,
          type: dataItem?.type ?? 'unknown',
          autoHeight: dataItem?.autoHeight ?? false,
          relativePosition: {
            top: Math.round(item.top),
            left: Math.round(item.left),
          },
          absolutePosition: {
            x: Math.round(absoluteX),
            y: Math.round(absoluteY),
          },
          dimensions: {
            width: Math.round(item.width),
            height: Math.round(item.height),
          },
          bounds: {
            left: Math.round(absoluteX),
            right: Math.round(absoluteX + item.width),
            top: Math.round(absoluteY),
            bottom: Math.round(absoluteY + item.height),
          },
        });
      });
      console.log('---');
      console.log('Total grid height:', gridViewHeight);
      console.log('=============================');
    }
  }, [
    gridItems,
    orderedData,
    gridViewHeight,
    containerSize,
    effectiveWidth,
    componentPadding,
  ]);

  useEffect(() => {
    activeDragLayoutRef.current = activeDragLayout;
  }, [activeDragLayout]);

  useEffect(() => {
    if (!isDragging.current) {
      setOrderedData(data);
    }
  }, [data]);

  const sumScrollViewHeight =
    gridViewHeight + headerComponentHeight + footerComponentHeight;

  // Extract padding from style object
  const extractPadding = (styleObj: StyleProp<ViewStyle>) => {
    if (!styleObj) return { horizontal: 0, vertical: 0 };

    const flatStyle = StyleSheet.flatten(styleObj);
    let horizontal = 0;
    let vertical = 0;

    if (flatStyle.padding !== undefined) {
      horizontal = vertical = Number(flatStyle.padding) || 0;
    }

    if (flatStyle.paddingHorizontal !== undefined) {
      horizontal = Number(flatStyle.paddingHorizontal) || 0;
    }

    if (flatStyle.paddingVertical !== undefined) {
      vertical = Number(flatStyle.paddingVertical) || 0;
    }

    if (
      flatStyle.paddingLeft !== undefined ||
      flatStyle.paddingRight !== undefined
    ) {
      const left = Number(flatStyle.paddingLeft) || 0;
      const right = Number(flatStyle.paddingRight) || 0;
      horizontal = Math.max(horizontal, left + right);
    }

    return { horizontal, vertical };
  };

  // Update padding values when style changes when component style is changed
  useEffect(() => {
    const newPadding = extractPadding(style);

    // Only update state if padding values have actually changed
    if (
      newPadding.horizontal !== componentPadding.horizontal ||
      newPadding.vertical !== componentPadding.vertical
    ) {
      setComponentPadding(newPadding);
    }
  }, [style, componentPadding.horizontal, componentPadding.vertical]);

  const updateVisibleItems = () => {
    if (!isVirtualizationEnabled) return;

    // Buffer to add outside visible range
    const buffer = containerSize.height * virtualizedBufferFactor;

    // Define the range of items that are visible based on scroll position
    const visibleStart = Math.max(0, scrollYPosition.current - buffer);
    const visibleEnd = scrollYPosition.current + containerSize.height + buffer;

    const vItems = gridItems.filter((item: GridItem) => {
      const itemBottom = item.top + item.height;
      const itemTop = item.top;
      // Check if the item is within the adjusted visible range, including the buffer
      return itemBottom > visibleStart && itemTop < visibleEnd;
    });

    setVisibleItems(vItems);
    return vItems;
  };

  const throttledUpdateVisibleItems = useThrottle(
    updateVisibleItems,
    scrollEventInterval
  );

  const throttledOnScroll = useThrottle(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;
      scrollYPosition.current = currentScrollY;

      // Calculate the position to check against the threshold
      const contentHeight = gridViewHeight;
      const scrollViewHeight = containerSize.height;
      const threshold = onEndReachedThreshold * scrollViewHeight;

      // Check if we've reached the threshold for calling onEndReached
      if (
        !onEndReachedCalled.current &&
        currentScrollY + scrollViewHeight + threshold >= contentHeight
      ) {
        onEndReachedCalled.current = true; // Marked as called to prevent subsequent calls
        onEndReached?.(); // call the onEndReached function if it exists
      }

      // Reset the flag when scrolled away from the bottom
      if (currentScrollY + scrollViewHeight + threshold * 2 < contentHeight) {
        onEndReachedCalled.current = false;
      }

      // Update visible items for virtualization
      if (isVirtualizationEnabled) {
        throttledUpdateVisibleItems();
      }
    },
    32
  );

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (onScrollProp) {
      onScrollProp(event);
    }

    throttledOnScroll(event);
  };

  useEffect(() => {
    if (isVirtualizationEnabled) {
      updateVisibleItems();
    }

    // Reset onEndReachedCalled to false when data changes, allowing onEndReached to be called again
    onEndReachedCalled.current = false;
  }, [gridItems, containerSize, isVirtualizationEnabled]);

  const findNearestIndex = (x: number, y: number, fallbackIndex: number) => {
    const currentGridItems = gridItemsRef.current;

    if (currentGridItems.length === 0) {
      return -1;
    }

    const withinItemIndex = currentGridItems.findIndex((item) => {
      return (
        x >= item.left &&
        x < item.left + item.width &&
        y >= item.top &&
        y < item.top + item.height
      );
    });

    if (withinItemIndex >= 0) {
      return withinItemIndex;
    }

    // Allow dropping into empty gaps above the currently dragged tile.
    // This is needed for cases like:
    // row 0: [1x1][empty]
    // row 1: [2x1]
    // where dragging 2x1 into the empty top-right gap should move it ahead in
    // order (and push the 1x1 down), even though the pointer is not directly
    // over an existing item.
    if (fallbackIndex >= 0) {
      const currentDraggedLayout = currentGridItems[fallbackIndex];

      if (currentDraggedLayout && y < currentDraggedLayout.top) {
        const orderedByVisualPosition = currentGridItems
          .map((item, index) => ({ item, index }))
          .sort((a, b) => {
            if (a.item.top !== b.item.top) {
              return a.item.top - b.item.top;
            }

            return a.item.left - b.item.left;
          });

        const rowTolerance = Math.max(
          1,
          (itemUnitHeight || currentDraggedLayout.height) * 0.4
        );

        let lastCandidateIndex = -1;

        orderedByVisualPosition.forEach(({ item, index }) => {
          if (item.top >= currentDraggedLayout.top) {
            return;
          }

          const isAbovePointerRow = item.top < y - rowTolerance;
          const isSamePointerRowAndBeforeX =
            Math.abs(item.top - y) <= rowTolerance && item.left <= x;

          if (isAbovePointerRow || isSamePointerRowAndBeforeX) {
            lastCandidateIndex = index;
          }
        });

        if (lastCandidateIndex >= 0) {
          return lastCandidateIndex;
        }

        // If pointer is above and before all prior items, place at start.
        return 0;
      }
    }

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    currentGridItems.forEach((item, index) => {
      const right = item.left + item.width;
      const bottom = item.top + item.height;
      const dx = x < item.left ? item.left - x : x > right ? x - right : 0;
      const dy = y < item.top ? item.top - y : y > bottom ? y - bottom : 0;
      const distance = dx * dx + dy * dy;

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    // Keep a tiny hysteresis around the current target to avoid rapid
    // oscillation when dragging through narrow gaps between mixed-size tiles.
    if (fallbackIndex >= 0 && fallbackIndex !== nearestIndex) {
      const fallbackItem = currentGridItems[fallbackIndex];

      if (fallbackItem) {
        const fallbackRight = fallbackItem.left + fallbackItem.width;
        const fallbackBottom = fallbackItem.top + fallbackItem.height;
        const fallbackDx =
          x < fallbackItem.left
            ? fallbackItem.left - x
            : x > fallbackRight
              ? x - fallbackRight
              : 0;
        const fallbackDy =
          y < fallbackItem.top
            ? fallbackItem.top - y
            : y > fallbackBottom
              ? y - fallbackBottom
              : 0;
        const fallbackDistance =
          fallbackDx * fallbackDx + fallbackDy * fallbackDy;

        if (nearestDistance + 4 >= fallbackDistance) {
          return fallbackIndex;
        }
      }
    }

    return nearestIndex;
  };

  const runLayoutAnimation = () => {
    if (!animation) {
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const moveItem = (currentData: TileItem[], from: number, to: number) => {
    if (from === to) {
      return currentData;
    }

    const next = [...currentData];
    const [removed] = next.splice(from, 1);

    if (removed === undefined) {
      return currentData;
    }

    next.splice(to, 0, removed);
    return next;
  };

  const swapItems = (currentData: TileItem[], from: number, to: number) => {
    if (from === to) {
      return currentData;
    }

    const next = [...currentData];
    const fromItem = next[from];
    const toItem = next[to];

    if (!fromItem || !toItem) {
      return currentData;
    }

    next[from] = toItem;
    next[to] = fromItem;
    return next;
  };

  const resolveLiveReorder = (
    currentData: TileItem[],
    fromIndex: number,
    targetIndex: number,
    desiredPoint: { x: number; y: number } | null
  ) => {
    const fromItem = currentData[fromIndex];
    const targetItemBase = currentData[targetIndex];

    if (!fromItem || !targetItemBase) {
      return currentData;
    }

    const fromWidth = fromItem.widthRatio ?? 1;
    const fromHeight = fromItem.heightRatio ?? 1;
    const targetWidth = targetItemBase.widthRatio ?? 1;
    const targetHeight = targetItemBase.heightRatio ?? 1;

    if (
      fromWidth === 1 &&
      fromHeight === 1 &&
      targetWidth === 1 &&
      targetHeight === 1
    ) {
      return swapItems(currentData, fromIndex, targetIndex);
    }

    const base = moveItem(currentData, fromIndex, targetIndex);

    if (!desiredPoint || containerSize.width <= 0) {
      return base;
    }

    const draggedItem = fromItem;
    const targetItem = targetItemBase;

    if (!draggedItem || !targetItem) {
      return base;
    }

    if ((targetItem.widthRatio ?? 1) <= 1) {
      return base;
    }

    const score = (order: TileItem[]) => {
      const { gridItems: layoutItems } = calcResponsiveGrid(
        order,
        maxItemsPerColumn,
        effectiveWidth > 0 ? effectiveWidth : containerSize.width,
        itemUnitHeight,
        autoAdjustItemWidth
      );

      const draggedIndex = order.indexOf(draggedItem);
      const draggedLayout =
        draggedIndex >= 0 ? layoutItems[draggedIndex] : undefined;

      if (!draggedLayout) {
        return Number.POSITIVE_INFINITY;
      }

      const right = draggedLayout.left + draggedLayout.width;
      const bottom = draggedLayout.top + draggedLayout.height;

      const dx =
        desiredPoint.x < draggedLayout.left
          ? draggedLayout.left - desiredPoint.x
          : desiredPoint.x > right
            ? desiredPoint.x - right
            : 0;

      const dy =
        desiredPoint.y < draggedLayout.top
          ? draggedLayout.top - desiredPoint.y
          : desiredPoint.y > bottom
            ? desiredPoint.y - bottom
            : 0;

      return dy * dy * 1000 + dx * dx;
    };

    let best = base;
    let bestScore = score(base);

    const baseTargetPos = base.indexOf(targetItem);
    if (baseTargetPos < 0) {
      return base;
    }

    const startPos = Math.max(0, baseTargetPos - 6);

    for (
      let insertPos = baseTargetPos - 1;
      insertPos >= startPos;
      insertPos--
    ) {
      const movedTarget = moveItem(base, baseTargetPos, insertPos);

      const candidateScore =
        score(movedTarget) + (baseTargetPos - insertPos) * 0.001;
      if (candidateScore < bestScore) {
        bestScore = candidateScore;
        best = movedTarget;
      }

      const draggedPos = movedTarget.indexOf(draggedItem);
      const desiredPos = Math.min(movedTarget.length - 1, insertPos + 1);

      if (draggedPos >= 0 && draggedPos !== desiredPos) {
        const movedDragged = moveItem(movedTarget, draggedPos, desiredPos);
        const movedDraggedScore =
          score(movedDragged) + (baseTargetPos - insertPos + 1) * 0.001;

        if (movedDraggedScore < bestScore) {
          bestScore = movedDraggedScore;
          best = movedDragged;
        }
      }
    }

    return best;
  };

  const finishDrag = () => {
    if (!isDragging.current) {
      return;
    }

    const fromIndex = dragFromIndex.current;
    const toIndex = dragCurrentIndex.current;
    const draggedItem = activeDragItemRef.current;

    isDragging.current = false;
    setIsDraggingState(false);

    dragOffset.setValue({ x: 0, y: 0 });
    setActiveDragLayout(null);
    setActiveDraggedItem(null);
    setDragSourceKeyState(null);
    setDragTargetIndexState(-1);

    if (
      draggedItem &&
      fromIndex >= 0 &&
      toIndex >= 0 &&
      fromIndex !== toIndex
    ) {
      onDragEnd?.({
        data: orderedDataRef.current,
        fromIndex,
        toIndex,
        item: draggedItem,
      });
    }

    dragFromIndex.current = -1;
    dragCurrentIndex.current = -1;
    dragLastCenterRef.current = null;
    lastLoggedPositionRef.current = null;
    activeDragItemRef.current = null;
  };

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: () => isDragging.current,
        onMoveShouldSetPanResponderCapture: () => isDragging.current,
        onPanResponderMove: (_, gestureState) => {
          if (!isDragging.current) {
            return;
          }

          dragOffset.setValue({
            x: gestureState.dx,
            y: gestureState.dy,
          });

          const dragLayout = activeDragLayoutRef.current;
          if (!dragLayout) {
            return;
          }

          const translatedX =
            direction === 'rtl' ? -gestureState.dx : gestureState.dx;
          const pointerX =
            dragLayout.left + translatedX + dragTouchOffsetRef.current.x;
          const pointerY =
            dragLayout.top + gestureState.dy + dragTouchOffsetRef.current.y;

          dragLastCenterRef.current = { x: pointerX, y: pointerY };

          const targetIndex = findNearestIndex(
            pointerX,
            pointerY,
            dragCurrentIndex.current
          );

          const targetLayout = gridItemsRef.current[targetIndex];
          if (targetLayout) {
            const contentWidth =
              effectiveWidth > 0 ? effectiveWidth : containerSize.width;
            const columnUnit = contentWidth / maxItemsPerColumn;
            const rowUnit = itemUnitHeight || columnUnit;

            if (columnUnit > 0 && rowUnit > 0) {
              const row = Math.round(targetLayout.top / rowUnit);
              const column = Math.round(targetLayout.left / columnUnit);
              const positionText = `Position (${row},${column})`;

              if (lastLoggedPositionRef.current !== positionText) {
                lastLoggedPositionRef.current = positionText;
              }
            }
          }

          const currentIndex = dragCurrentIndex.current;

          if (targetIndex < 0 || targetIndex === currentIndex) {
            return;
          }

          if (draggable) {
            const draggedItem = activeDragItemRef.current;
            const nextData = resolveLiveReorder(
              orderedDataRef.current,
              currentIndex,
              targetIndex,
              dragLastCenterRef.current
            );

            if (nextData !== orderedDataRef.current) {
              if (animation) {
                runLayoutAnimation();
              }

              orderedDataRef.current = nextData;
              setOrderedData(nextData);

              if (draggedItem) {
                dragCurrentIndex.current = nextData.indexOf(draggedItem);
              } else {
                dragCurrentIndex.current = targetIndex;
              }

              setDragTargetIndexState(dragCurrentIndex.current);
              return;
            }
          }

          dragCurrentIndex.current = targetIndex;
          setDragTargetIndexState(targetIndex);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
      }),
    [
      direction,
      draggable,
      animation,
      effectiveWidth,
      containerSize.width,
      maxItemsPerColumn,
      itemUnitHeight,
    ]
  );

  const startDrag = (index: number) => {
    if (!draggable || isDragging.current) {
      return;
    }

    const item = orderedDataRef.current[index];
    const itemLayout = gridItemsRef.current[index];

    if (!item || !itemLayout) {
      return;
    }

    dragOffset.setValue({ x: 0, y: 0 });
    dragFromIndex.current = index;
    dragCurrentIndex.current = index;
    activeDragItemRef.current = item;
    isDragging.current = true;
    setIsDraggingState(true);
    setActiveDraggedItem(item);
    setDragSourceKeyState(keyExtractor(item, index));
    setDragTargetIndexState(index);
    setActiveDragLayout({
      top: itemLayout.top,
      left: itemLayout.left,
      width: itemLayout.width,
      height: itemLayout.height,
    });

    onDragStart?.({ item, index });
  };

  const startDragWithEvent = (index: number, event: GestureResponderEvent) => {
    console.log('dragging', index);
    dragTouchOffsetRef.current = {
      x: event.nativeEvent.locationX,
      y: event.nativeEvent.locationY,
    };

    startDrag(index);
  };

  const getItemPositionStyle = (item: GridItem) => {
    const isAutoHeight = item.autoHeight === true;
    const baseStyle: Record<string, number | string> = {
      position: 'absolute' as const,
      top: item.top,
      width: item.width,
    };

    // For autoHeight items, use minHeight instead of height to allow content to expand
    if (isAutoHeight) {
      baseStyle.minHeight = item.height;
    } else {
      baseStyle.height = item.height;
    }

    return {
      ...baseStyle,
      ...(direction === 'rtl' ? { right: item.left } : { left: item.left }),
    };
  };

  const activeDropTargetItem =
    isDraggingState &&
    dragTargetIndexState >= 0 &&
    dragTargetIndexState !== dragFromIndex.current
      ? gridItems[dragTargetIndexState]
      : null;

  return (
    <View
      ref={containerViewRef}
      style={[
        {
          flexGrow: 1,
          overflow: 'hidden' as const,
        },
        style,
      ]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setContainerSize({ width, height });
        measureContainerPosition();
      }}
    >
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={onScrollProp ? 16 : 32}
        horizontal={false}
        scrollEnabled={!isDraggingState}
        bounces={bounces}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          height: sumScrollViewHeight || '100%',
          width: '100%',
        }}
        showsVerticalScrollIndicator={showScrollIndicator}
        removeClippedSubviews={removeClippedSubviews}
      >
        {/* Render HeaderComponent if provided */}
        <View
          onLayout={({ nativeEvent }) => {
            setHeaderComponentHeight(nativeEvent.layout.height);
          }}
        >
          {renderPropComponent(HeaderComponent)}
        </View>

        <View
          style={{
            position: 'relative',
            width: '100%',
          }}
          {...(draggable ? panResponder.panHandlers : {})}
        >
          {renderedItems.map((item, index) => {
            const dataIndex = (item as GridItem).dataIndex ?? index;
            const dataItem = item as TileItem;
            const itemKey = keyExtractor(dataItem, dataIndex);
            const isActiveDragItem =
              draggable && isDraggingState && itemKey === dragSourceKeyState;
            const isAutoHeight = (dataItem as TileItem).autoHeight;

            return (
              <View
                key={itemKey}
                style={[
                  getItemPositionStyle(item),
                  itemContainerStyle,
                  isActiveDragItem ? { opacity: 0 } : null,
                ]}
                onLayout={
                  isAutoHeight
                    ? (event) => {
                        const { height } = event.nativeEvent.layout;
                        const itemKeyStr = String(dataIndex);
                        setMeasuredHeights((prev) => {
                          // Only update if height changed significantly (more than 1px)
                          if (Math.abs((prev[itemKeyStr] ?? 0) - height) > 1) {
                            return { ...prev, [itemKeyStr]: height };
                          }
                          return prev;
                        });
                      }
                    : undefined
                }
              >
                <Pressable
                  disabled={!draggable}
                  delayLongPress={dragActivationDelay}
                  onLongPress={(event) => startDragWithEvent(dataIndex, event)}
                  style={{ flex: 1 }}
                >
                  {renderItem({ item: dataItem, index: dataIndex })}
                </Pressable>
              </View>
            );
          })}

          {draggable && activeDropTargetItem ? (
            <View
              pointerEvents="none"
              style={[
                getItemPositionStyle(activeDropTargetItem),
                itemContainerStyle,
                {
                  backgroundColor: dragPlaceholderColor,
                  borderWidth: dragPlaceholderBorderWidth,
                  borderColor: dragPlaceholderBorderColor,
                  zIndex: 800,
                },
              ]}
            />
          ) : null}

          {draggable && activeDraggedItem && activeDragLayout ? (
            <Animated.View
              pointerEvents="none"
              style={[
                {
                  position: 'absolute',
                  top: activeDragLayout.top,
                  width: activeDragLayout.width,
                  height: activeDragLayout.height,
                  zIndex: 999,
                  transform: [
                    {
                      translateX:
                        direction === 'rtl'
                          ? Animated.multiply(dragOffset.x, -1)
                          : dragOffset.x,
                    },
                    { translateY: dragOffset.y },
                    { scale: dragScale },
                  ],
                  opacity: dragOpacity,
                },
                direction === 'rtl'
                  ? { right: activeDragLayout.left }
                  : { left: activeDragLayout.left },
                itemContainerStyle,
              ]}
            >
              {renderItem({
                item: activeDraggedItem,
                index: dragFromIndex.current,
              })}
            </Animated.View>
          ) : null}
        </View>

        {/* Render FooterComponent if provided */}
        <View
          onLayout={({ nativeEvent }) => {
            setFooterComponentHeight(nativeEvent.layout.height);
          }}
        >
          {renderPropComponent(FooterComponent)}
        </View>
      </ScrollView>
    </View>
  );
};

/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable react-native/no-inline-styles */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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

  const [dragPreviewData, setDragPreviewData] = useState<TileItem[] | null>(
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

  const activeDragItemRef = useRef<TileItem | null>(null);

  const gridItemsRef = useRef<GridItem[]>([]);

  const dragHitTestItemsRef = useRef<GridItem[]>([]);

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

  const layoutData =
    draggable && animation && dragPreviewData ? dragPreviewData : orderedData;

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
    ]
  );

  const renderedItems = isVirtualizationEnabled ? visibleItems : gridItems;

  useEffect(() => {
    orderedDataRef.current = orderedData;
  }, [orderedData]);

  useEffect(() => {
    gridItemsRef.current = gridItems;
  }, [gridItems]);

  useEffect(() => {
    activeDragLayoutRef.current = activeDragLayout;
  }, [activeDragLayout]);

  useEffect(() => {
    if (!isDragging.current) {
      setOrderedData(data);
      setDragPreviewData(null);
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

  const swapData = (
    currentData: TileItem[],
    fromIndex: number,
    toIndex: number
  ) => {
    if (fromIndex === toIndex) return currentData;

    const swapped = [...currentData];
    const fromItem = swapped[fromIndex];
    const toItem = swapped[toIndex];

    if (!fromItem || !toItem) {
      return currentData;
    }

    swapped[fromIndex] = toItem;
    swapped[toIndex] = fromItem;

    return swapped;
  };

  const findNearestIndex = (x: number, y: number) => {
    const currentGridItems =
      isDragging.current && dragHitTestItemsRef.current.length > 0
        ? dragHitTestItemsRef.current
        : gridItemsRef.current;

    if (currentGridItems.length === 0) {
      return -1;
    }

    const withinItemIndex = currentGridItems.findIndex((item) => {
      return (
        x >= item.left &&
        x <= item.left + item.width &&
        y >= item.top &&
        y <= item.top + item.height
      );
    });

    if (withinItemIndex >= 0) {
      return withinItemIndex;
    }

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    currentGridItems.forEach((item, index) => {
      const centerX = item.left + item.width / 2;
      const centerY = item.top + item.height / 2;
      const distance = (centerX - x) ** 2 + (centerY - y) ** 2;

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    return nearestIndex;
  };

  const runLayoutAnimation = () => {
    if (!animation) {
      return;
    }

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
    setDragPreviewData(null);
    dragHitTestItemsRef.current = [];
    setDragSourceKeyState(null);
    setDragTargetIndexState(-1);

    if (
      draggedItem &&
      fromIndex >= 0 &&
      toIndex >= 0 &&
      fromIndex !== toIndex
    ) {
      runLayoutAnimation();
      const swappedData = swapData(orderedDataRef.current, fromIndex, toIndex);
      orderedDataRef.current = swappedData;
      setOrderedData(swappedData);

      onDragEnd?.({
        data: swappedData,
        fromIndex,
        toIndex,
        item: draggedItem,
      });
    }

    dragFromIndex.current = -1;
    dragCurrentIndex.current = -1;
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
          const centerX = dragLayout.left + translatedX + dragLayout.width / 2;
          const centerY =
            dragLayout.top + gestureState.dy + dragLayout.height / 2;

          const targetIndex = findNearestIndex(centerX, centerY);
          const currentIndex = dragCurrentIndex.current;

          if (targetIndex < 0 || targetIndex === currentIndex) {
            return;
          }

          if (draggable && animation) {
            runLayoutAnimation();
            const previewData = swapData(
              orderedDataRef.current,
              dragFromIndex.current,
              targetIndex
            );
            setDragPreviewData(previewData);
          }

          dragCurrentIndex.current = targetIndex;
          setDragTargetIndexState(targetIndex);
        },
        onPanResponderTerminationRequest: () => false,
        onPanResponderRelease: finishDrag,
        onPanResponderTerminate: finishDrag,
      }),
    [direction, draggable, animation]
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
    dragHitTestItemsRef.current = [...gridItemsRef.current];
    isDragging.current = true;
    setIsDraggingState(true);
    setActiveDraggedItem(item);
    setDragPreviewData(null);
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

  const getItemPositionStyle = (item: GridItem) => {
    const baseStyle = {
      position: 'absolute' as const,
      top: item.top,
      width: item.width,
      height: item.height,
    };

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

            return (
              <View
                key={itemKey}
                style={[
                  getItemPositionStyle(item),
                  itemContainerStyle,
                  isActiveDragItem ? { opacity: 0 } : null,
                ]}
              >
                <Pressable
                  disabled={!draggable}
                  delayLongPress={dragActivationDelay}
                  onLongPress={() => startDrag(dataIndex)}
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

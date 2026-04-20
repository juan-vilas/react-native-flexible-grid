/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useState } from 'react';

import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { ResponsiveGrid } from 'react-native-flexible-grid';

export default function InstagramExploreExample() {
  const [data, setData] = useState<DataProp[]>([]);

  interface DataProp {
    id: number;
    widthRatio?: number;
    heightRatio?: number;
    imageUrl: string;
  }

  const generateData = () => {
    let originalData = [
      {
        id: 0,
        imageUrl: 'Example 1',
      },
      {
        id: 1,
        imageUrl: 'Example 2',
      },
      {
        id: 2,
        imageUrl: 'Example 3',
        heightRatio: 2,
      },
      {
        id: 3,
        imageUrl: 'Example 4',
      },
      {
        id: 4,
        imageUrl: 'Example 5',
      },
      {
        id: 5,
        imageUrl: 'Example 6',

        widthRatio: 2,
        heightRatio: 1,
      },
      {
        id: 6,
        imageUrl: 'Example 7',

        widthRatio: 2,
        heightRatio: 2,
      },
      {
        id: 7,
        imageUrl: 'Example 8',
      },
    ];

    return originalData;
  };

  const renderItem = ({ item }: { item: DataProp }) => {
    return (
      <View
        style={[
          styles.boxContainer,
          {
            backgroundColor: '#37404E',
            margin: 4,
            borderRadius: 4,
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Text>{item.imageUrl}</Text>
      </View>
    );
  };

  useEffect(() => {
    setData(generateData());
  }, []);

  return (
    <SafeAreaView
      style={{
        flex: 1,
      }}
    >
      <ResponsiveGrid
        maxItemsPerColumn={2}
        removeClippedSubviews={false}
        animation
        data={data}
        renderItem={renderItem}
        draggable
        onDragEnd={({ data: reorderedData }) => {
          console.log(reorderedData);
          setData(reorderedData as DataProp[]);
        }}
        showScrollIndicator={false}
        style={{
          padding: 5,
        }}
        keyExtractor={(item: DataProp) => item.id.toString()}
      />

      <View
        style={{
          position: 'absolute',
          width: '100%',
          bottom: 0,
        }}
      ></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  boxContainer: {
    flex: 1,
    margin: 1,
  },
  image: {
    width: 100,
    height: 100,
  },
  box: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  text: {
    color: 'white',
    fontSize: 10,
    position: 'absolute',
    bottom: 10,
  },
});

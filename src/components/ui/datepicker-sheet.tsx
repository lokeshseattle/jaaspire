import DateTimePicker from "@react-native-community/datetimepicker";
import React from "react";
import { Button, Platform } from "react-native";
import BottomSheet from "./bottom-sheet";

interface Props {
  visible: boolean;
  value: Date | null;
  onChange: (date: Date) => void;
  onClose: () => void;
}

export default function DatePickerSheet({
  visible,
  value,
  onChange,
  onClose,
}: Props) {
  const currentDate = value ?? new Date();

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <DateTimePicker
        value={currentDate}
        mode="date"
        display={Platform.OS === "ios" ? "spinner" : "default"}
        maximumDate={new Date()}
        onChange={(e, selectedDate) => {
          if (selectedDate) {
            onChange(selectedDate);
          }
        }}
      />

      <Button title="Done" onPress={onClose} />
    </BottomSheet>
  );
}

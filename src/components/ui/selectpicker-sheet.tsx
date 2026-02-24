import { Picker } from "@react-native-picker/picker";
import React from "react";
import BottomSheet from "./bottom-sheet";

interface Option {
  label: string;
  value: string;
}

interface Props {
  visible: boolean;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  onClose: () => void;
}

export default function SelectPickerSheet({
  visible,
  value,
  options,
  onChange,
  onClose,
}: Props) {
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Picker selectedValue={value} onValueChange={onChange}>
        {options.map((opt) => (
          <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
        ))}
      </Picker>
    </BottomSheet>
  );
}

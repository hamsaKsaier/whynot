import { describe, it, expect } from 'vitest';
import { ActionType, FailureCategory } from '../types/index';

describe('ActionType enum', () => {
  it('has all base action values', () => {
    expect(ActionType.NAVIGATE).toBe('navigate');
    expect(ActionType.CLICK).toBe('click');
    expect(ActionType.TYPE).toBe('type');
    expect(ActionType.FILL).toBe('fill');
    expect(ActionType.SELECT).toBe('select');
    expect(ActionType.WAIT).toBe('wait');
    expect(ActionType.ASSERT).toBe('assert');
    expect(ActionType.SCROLL).toBe('scroll');
    expect(ActionType.HOVER).toBe('hover');
  });

  it('has smart assertion subtypes', () => {
    expect(ActionType.ASSERT_URL_CONTAINS).toBe('assert_url_contains');
    expect(ActionType.ASSERT_URL_EQUALS).toBe('assert_url_equals');
    expect(ActionType.ASSERT_TEXT_VISIBLE).toBe('assert_text_visible');
    expect(ActionType.ASSERT_ELEMENT_EXISTS).toBe('assert_element_exists');
    expect(ActionType.ASSERT_ELEMENT_NOT_EXISTS).toBe('assert_element_not_exists');
    expect(ActionType.ASSERT_NO_CONSOLE_ERRORS).toBe('assert_no_console_errors');
    expect(ActionType.ASSERT_INPUT_VALUE).toBe('assert_input_value');
  });

  it('has phase 9 assertion types', () => {
    expect(ActionType.ASSERT_ELEMENT_VISIBLE).toBe('assert_element_visible');
    expect(ActionType.ASSERT_ELEMENT_COUNT).toBe('assert_element_count');
    expect(ActionType.ASSERT_ATTRIBUTE_CONTAINS).toBe('assert_attribute_contains');
  });

  it('has correct total count', () => {
    const values = Object.values(ActionType);
    expect(values).toHaveLength(19);
  });
});

describe('FailureCategory enum', () => {
  it('has all category values', () => {
    expect(FailureCategory.SELECTOR_FAILURE).toBe('selector_failure');
    expect(FailureCategory.TIMING_FAILURE).toBe('timing_failure');
    expect(FailureCategory.PAGE_LOAD_FAILURE).toBe('page_load_failure');
    expect(FailureCategory.SELECTOR_INSTABILITY).toBe('selector_instability');
    expect(FailureCategory.ELEMENT_MISSING).toBe('element_missing');
    expect(FailureCategory.ELEMENT_NOT_VISIBLE).toBe('element_not_visible');
    expect(FailureCategory.ELEMENT_NOT_INTERACTABLE).toBe('element_not_interactable');
    expect(FailureCategory.ASSERTION_FAILURE).toBe('assertion_failure');
    expect(FailureCategory.FUNCTIONAL_BUG).toBe('functional_bug');
    expect(FailureCategory.UNKNOWN).toBe('unknown');
  });

  it('has correct total count', () => {
    expect(Object.values(FailureCategory)).toHaveLength(10);
  });
});

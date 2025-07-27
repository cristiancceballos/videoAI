import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Platform } from 'react-native';
import { BarChart3, DollarSign, AlertTriangle, Settings } from 'lucide-react-native';
import { costMonitoring } from '../utils/costMonitoring';
import { getInterFontConfig } from '../utils/fontUtils';

interface CloudinaryUsageDashboardProps {
  onClose?: () => void;
}

export function CloudinaryUsageDashboard({ onClose }: CloudinaryUsageDashboardProps) {
  const usageSummary = costMonitoring.getUsageSummary();
  const { costEstimate } = usageSummary;

  const getUsageColor = (percentage: number) => {
    if (percentage >= 90) return '#FF3B30';
    if (percentage >= 80) return '#FF9500';
    if (percentage >= 60) return '#FFCC00';
    return '#34C759';
  };

  const handleSetLimit = () => {
    const message = `Current monthly limit: ${usageSummary.monthlyLimit} thumbnails\n\nEnter new monthly limit (recommended: 200 for free tier):`;
    
    if (Platform.OS === 'web') {
      const input = window.prompt(message, usageSummary.monthlyLimit.toString());
      if (input && !isNaN(Number(input))) {
        costMonitoring.setMonthlyLimit(Number(input));
      }
    } else {
      Alert.prompt(
        'Set Monthly Limit',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Update',
            onPress: (input) => {
              if (input && !isNaN(Number(input))) {
                costMonitoring.setMonthlyLimit(Number(input));
              }
            },
          },
        ],
        'plain-text',
        usageSummary.monthlyLimit.toString()
      );
    }
  };

  const handleReset = () => {
    const message = 'Are you sure you want to reset usage counters? This action cannot be undone.';
    
    if (Platform.OS === 'web') {
      if (window.confirm(message)) {
        costMonitoring.resetUsage();
      }
    } else {
      Alert.alert(
        'Reset Usage',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reset',
            style: 'destructive',
            onPress: () => costMonitoring.resetUsage(),
          },
        ]
      );
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <BarChart3 size={20} color="#fff" />
          <Text style={styles.title}>Cloudinary Usage</Text>
        </View>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Usage Progress */}
        <View style={styles.usageCard}>
          <Text style={styles.cardTitle}>Monthly Thumbnail Usage</Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { 
                    width: `${Math.min(100, usageSummary.percentageUsed)}%`,
                    backgroundColor: getUsageColor(usageSummary.percentageUsed)
                  }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {usageSummary.thumbnailCount} / {usageSummary.monthlyLimit} 
              ({usageSummary.percentageUsed.toFixed(1)}%)
            </Text>
          </View>
        </View>

        {/* Cost Estimate */}
        <View style={styles.costCard}>
          <View style={styles.cardHeader}>
            <DollarSign size={16} color="#34C759" />
            <Text style={styles.cardTitle}>Cost Estimate</Text>
          </View>
          
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Current Month:</Text>
            <Text style={styles.costValue}>
              ${costEstimate.currentMonthCost.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Projected Month:</Text>
            <Text style={[styles.costValue, costEstimate.projectedMonthlyCost > 5 && styles.costWarning]}>
              ${costEstimate.projectedMonthlyCost.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.costRow}>
            <Text style={styles.costLabel}>Free Tier Remaining:</Text>
            <Text style={styles.costValue}>
              {costEstimate.remainingFreeTier} thumbnails
            </Text>
          </View>
        </View>

        {/* Warnings */}
        {(costEstimate.isOverFreeTier || usageSummary.percentageUsed >= 80) && (
          <View style={styles.warningCard}>
            <AlertTriangle size={16} color="#FF9500" />
            <View style={styles.warningContent}>
              {costEstimate.isOverFreeTier && (
                <Text style={styles.warningText}>
                  ⚠️ You've exceeded the free tier limit. Additional thumbnails cost ~$0.007 each.
                </Text>
              )}
              {usageSummary.percentageUsed >= 80 && (
                <Text style={styles.warningText}>
                  🚨 Approaching monthly limit. Consider optimizing usage or increasing limit.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton} onPress={handleSetLimit}>
            <Settings size={16} color="#007AFF" />
            <Text style={styles.actionText}>Set Limit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.actionButton, styles.resetButton]} onPress={handleReset}>
            <Text style={styles.resetText}>Reset</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.disclaimer}>
          * Cost estimates are approximate and based on Cloudinary's standard pricing.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    margin: 16,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#2a2a2a',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginLeft: 8,
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: {
    fontSize: 20,
    color: '#999',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  usageCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#fff',
    marginBottom: 12,
  },
  progressContainer: {
    marginTop: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#333',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#999',
    textAlign: 'center',
  },
  costCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  costRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  costLabel: {
    fontSize: 13,
    ...getInterFontConfig('200'),
    color: '#ccc',
  },
  costValue: {
    fontSize: 13,
    fontWeight: '600',
    ...getInterFontConfig('300'),
    color: '#34C759',
  },
  costWarning: {
    color: '#FF9500',
  },
  warningCard: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  warningContent: {
    flex: 1,
    marginLeft: 8,
  },
  warningText: {
    fontSize: 12,
    ...getInterFontConfig('200'),
    color: '#FF9500',
    lineHeight: 16,
    marginBottom: 4,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#333',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    flex: 1,
    marginHorizontal: 4,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13,
    ...getInterFontConfig('300'),
    color: '#007AFF',
    marginLeft: 6,
  },
  resetButton: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  resetText: {
    fontSize: 13,
    ...getInterFontConfig('300'),
    color: '#FF3B30',
  },
  disclaimer: {
    fontSize: 10,
    ...getInterFontConfig('200'),
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
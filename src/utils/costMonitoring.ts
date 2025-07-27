// Simple cost monitoring utility for Cloudinary usage
// Tracks thumbnail generation count and provides cost estimates

interface CloudinaryUsageData {
  thumbnailCount: number;
  lastReset: string;
  monthlyLimit: number;
}

class CostMonitoring {
  private storageKey = 'cloudinary_usage_tracking';
  
  // Cloudinary pricing estimates (approximate)
  private readonly THUMBNAIL_COST = 0.007; // ~$0.007 per thumbnail (based on 0.2 credits)
  private readonly FREE_TIER_LIMIT = 125; // ~125 thumbnails in free tier (25 credits)
  
  /**
   * Records a thumbnail generation
   */
  recordThumbnailGeneration(): void {
    const usage = this.getUsage();
    usage.thumbnailCount++;
    this.saveUsage(usage);
    
    console.log(`💰 [COST MONITOR] Thumbnail generated. Count: ${usage.thumbnailCount}/${usage.monthlyLimit}`);
    
    // Check if approaching limits
    this.checkUsageLimits(usage);
  }
  
  /**
   * Gets current usage statistics
   */
  getUsage(): CloudinaryUsageData {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) {
        return this.getDefaultUsage();
      }
      
      const data = JSON.parse(stored) as CloudinaryUsageData;
      
      // Check if we need to reset for new month
      const lastReset = new Date(data.lastReset);
      const now = new Date();
      
      if (now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()) {
        console.log('📅 [COST MONITOR] New month detected, resetting usage counters');
        return this.getDefaultUsage();
      }
      
      return data;
    } catch (error) {
      console.error('❌ [COST MONITOR] Error reading usage data:', error);
      return this.getDefaultUsage();
    }
  }
  
  /**
   * Gets cost estimates based on current usage
   */
  getCostEstimate(): {
    currentMonthCost: number;
    remainingFreeTier: number;
    projectedMonthlyCost: number;
    isOverFreeTier: boolean;
  } {
    const usage = this.getUsage();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const currentDay = new Date().getDate();
    
    const currentMonthCost = Math.max(0, (usage.thumbnailCount - this.FREE_TIER_LIMIT) * this.THUMBNAIL_COST);
    const remainingFreeTier = Math.max(0, this.FREE_TIER_LIMIT - usage.thumbnailCount);
    const dailyAverage = usage.thumbnailCount / currentDay;
    const projectedMonthlyCount = dailyAverage * daysInMonth;
    const projectedMonthlyCost = Math.max(0, (projectedMonthlyCount - this.FREE_TIER_LIMIT) * this.THUMBNAIL_COST);
    
    return {
      currentMonthCost,
      remainingFreeTier,
      projectedMonthlyCost,
      isOverFreeTier: usage.thumbnailCount > this.FREE_TIER_LIMIT
    };
  }
  
  /**
   * Gets usage summary for display
   */
  getUsageSummary(): {
    thumbnailCount: number;
    monthlyLimit: number;
    percentageUsed: number;
    costEstimate: ReturnType<typeof this.getCostEstimate>;
  } {
    const usage = this.getUsage();
    const costEstimate = this.getCostEstimate();
    const percentageUsed = (usage.thumbnailCount / usage.monthlyLimit) * 100;
    
    return {
      thumbnailCount: usage.thumbnailCount,
      monthlyLimit: usage.monthlyLimit,
      percentageUsed: Math.min(100, percentageUsed),
      costEstimate
    };
  }
  
  /**
   * Sets a custom monthly limit for alerts
   */
  setMonthlyLimit(limit: number): void {
    const usage = this.getUsage();
    usage.monthlyLimit = limit;
    this.saveUsage(usage);
    
    console.log(`📊 [COST MONITOR] Monthly limit updated to: ${limit} thumbnails`);
  }
  
  /**
   * Resets usage counters (for testing or manual reset)
   */
  resetUsage(): void {
    this.saveUsage(this.getDefaultUsage());
    console.log('🔄 [COST MONITOR] Usage counters reset');
  }
  
  private getDefaultUsage(): CloudinaryUsageData {
    return {
      thumbnailCount: 0,
      lastReset: new Date().toISOString(),
      monthlyLimit: 200 // Conservative limit to stay within reasonable costs
    };
  }
  
  private saveUsage(usage: CloudinaryUsageData): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(usage));
    } catch (error) {
      console.error('❌ [COST MONITOR] Error saving usage data:', error);
    }
  }
  
  private checkUsageLimits(usage: CloudinaryUsageData): void {
    const percentageUsed = (usage.thumbnailCount / usage.monthlyLimit) * 100;
    
    // Alert at 80% of monthly limit
    if (percentageUsed >= 80 && usage.thumbnailCount % 10 === 0) {
      console.warn(`⚠️ [COST MONITOR] High usage alert: ${usage.thumbnailCount}/${usage.monthlyLimit} thumbnails (${percentageUsed.toFixed(1)}%)`);
    }
    
    // Alert when exceeding free tier
    if (usage.thumbnailCount === this.FREE_TIER_LIMIT + 1) {
      console.warn(`💳 [COST MONITOR] Free tier exceeded! Now incurring charges of ~$${this.THUMBNAIL_COST} per thumbnail`);
    }
    
    // Alert at monthly limit
    if (usage.thumbnailCount >= usage.monthlyLimit) {
      console.error(`🚨 [COST MONITOR] Monthly limit reached! Consider increasing limit or optimizing usage.`);
    }
  }
}

export const costMonitoring = new CostMonitoring();
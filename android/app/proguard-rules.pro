# Google Play Protect & R8 Optimization Rules for Facility and Fleet Maintanance
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod,SourceFile,LineNumberTable
-keep class com.lucianpop.facilityfleetmaintanance.** { *; }
-keepclassmembers class com.lucianpop.facilityfleetmaintanance.** {
    @android.webkit.JavascriptInterface <methods>;
}
-dontwarn androidx.webkit.**
-dontwarn androidx.work.**
